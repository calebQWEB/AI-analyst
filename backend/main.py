# main.py
import os
import re
import asyncio
import tempfile
import io
import json
import uuid # For generating unique session IDs
from datetime import datetime, timedelta # For session expiry
import traceback

from langchain_core.chat_history import BaseChatMessageHistory # Ensure this is imported
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain.memory import ConversationBufferMemory
from typing import List, Dict, Any, Optional, Literal
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import pandas as pd
from supabase import create_client, Client
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, SystemMessage # Added AIMessage
from langchain_core.prompts import PromptTemplate
from langchain.agents.agent_types import AgentType
from langchain_together import Together
from langchain_together import ChatTogether
from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict
from langchain_experimental.agents.agent_toolkits import create_pandas_dataframe_agent
from fastapi.middleware.cors import CORSMiddleware # Keep this for CORS
# --- END NEW IMPORTS ---

# Load API key
# --- 1. Load Environment Variables ---
load_dotenv()

# --- 2. Initialize Supabase Client ---
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Supabase URL and Key must be set in .env file")

supabase_client: Client = create_client(supabase_url, supabase_key)

# --- 3. Initialize LLM ---
together_api_key = os.environ.get("TOGETHER_API_KEY")
if not together_api_key:
    raise ValueError("TOGETHER_API_KEY must be set in .env variables.")

# llm = Together(
#     model="mistralai/Mixtral-8x7B-Instruct-v0.1",
#     temperature=0.7, # Slightly increased temp for more varied analysis, adjust if needed
#     together_api_key=together_api_key,
#     max_tokens=2000
# )

llm = ChatTogether(
    model="mistralai/Mixtral-8x7B-Instruct-v0.1",  # Often better at structured output
    temperature=0.1,
    together_api_key=together_api_key,
    max_tokens=3000
)

# --- GLOBAL PLACEHOLDERS FOR SESSION MANAGEMENT (FOR DEVELOPMENT/SINGLE-USER TESTING ONLY) ---
# In production, this would be replaced by database-backed session management.
# These will hold the DataFrame and initial analysis for the *last* processed session.
global_last_processed_df: Optional[pd.DataFrame] = None
global_last_processed_analysis: str = ""
global_current_session_id: Optional[str] = None


# --- 4. Define Agent State (TypedDict) ---
class AgentState(TypedDict):
    """
    Represents the state of our graph.

    Attributes:
        data: Initial input data (e.g., Supabase file path).
        loaded_data: The actual parsed tabular data (list of dictionaries).
        dataframe: The Pandas DataFrame loaded from the Excel file.
        analysis: The generated analysis from the LLM.
        response: The final response to the user.
        tags: Categorization tags for the analysis.
        structured_insights: Extracted structured insights (JSON).
        error: Any error message encountered.
        session_id: The ID for this analysis session in the database. (NEW)
    """
    data: List[Dict[str, Any]]
    loaded_data: List[Dict[str, Any]]
    dataframe: Optional[Any] # Using Any because TypedDict is strict about actual type like pd.DataFrame
    analysis: str
    response: str
    tags: List[str]
    structured_insights: List[Dict[str, Any]]
    error: Optional[str]
    session_id: Optional[str]

# Describes the structure of a single insight
class Insight(BaseModel):
    label: str = Field(description="Title-cased label for the insight")
    value: str = Field(description="The value of the insight, including symbols")
    trend: Literal["up", "down", "stable"] = Field(description="The trend direction")
    context: str = Field(description="Short, lowercase time-based context (e.g., 'last month')")
    data: List[Dict[str, Any]] = Field(description="An array of objects for charting, e.g., [{'name': 'Q1', 'value': 5000}]")


# Describes the top-level structure, which is a list of insights
class StructuredInsights(BaseModel):
    insights: List[Insight] = Field(description="A list of key business insights")

# --- 5. Graph Nodes ---
# All nodes are now `async` to work with LangGraph's asynchronous invocation.

class SessionDataResponse(BaseModel):
    session_id: str
    dataframe_storage_path: str
    initial_analysis: Optional[str] = None
    chat_history: List[Dict[str, str]] = [] # List of {"role": "user/assistant", "content": "..."}
    categorized_insights: List[Dict[str, Any]]
    # Add any other relevant fields you store in analysis_sessions table if frontend needs them

class AllSessionsResponse(BaseModel):
    sessions: List[SessionDataResponse]

async def load_data_node(state: AgentState) -> dict:
    """
    Loads the initial data into the state. It can handle either:
    1. A 'supabase_excel' type in the input data payload with a 'path'.
    2. Direct list of dictionaries (tabular data) in the input data payload.
    It also creates a new session in the DB and stores the processed DataFrame if applicable.
    """
    print("--- Node: load_data ---")
    input_data_payload = state.get("data", []) # This is the 'data' field from the InvokeRequest
    loaded_data_for_analysis: List[Dict[str, Any]] = []
    df_result: Optional[pd.DataFrame] = None
    session_id: Optional[str] = None # Will be set during session creation
    original_source_description: str = "Directly provided data" # To store in DB

    if not input_data_payload:
        print("No input data payload found.")
        return {"loaded_data": [], "dataframe": None, "session_id": None, "error": "No input data provided."}

    # First, determine the data source and load into df_result
    is_supabase_file_input = False
    file_path_in_supabase: Optional[str] = None

    # Check if the input is a Supabase file path
    if input_data_payload and isinstance(input_data_payload, list) and len(input_data_payload) == 1 and \
       input_data_payload[0].get("type") == "supabase_excel" and input_data_payload[0].get("path"):
        is_supabase_file_input = True
        file_path_in_supabase = input_data_payload[0]["path"]
        original_source_description = f"Supabase Storage: {file_path_in_supabase}"

    if is_supabase_file_input:
        print(f"Attempting to download and parse file from Supabase Storage: {file_path_in_supabase}")

        if not supabase_client:
            print("ERROR: Supabase client not initialized!")
            return {"error": "Supabase client not initialized."}

        bucket_name = "uploads" # Ensure this matches your bucket name exactly
        try:
            print(f"DEBUG: Attempting to download from bucket '{bucket_name}' with path '{file_path_in_supabase}'")
            response_bytes = supabase_client.storage.from_(bucket_name).download(file_path_in_supabase)

            if response_bytes is None or not response_bytes:
                error_msg = f"ERROR: Supabase download returned empty or None for file: {file_path_in_supabase}. Check file path and RLS policies (use Service Role Key)."
                print(error_msg)
                return {"error": error_msg}

            print(f"DEBUG: Successfully downloaded {len(response_bytes)} bytes.")

            # Use io.BytesIO to read Excel directly from memory (resolved previous file errors)
            try:
                df = pd.read_excel(io.BytesIO(response_bytes))
                df_result = df # Store the DataFrame for later use in graph state
                loaded_data_for_analysis.extend(df.to_dict(orient='records')) # Convert DataFrame to list of dicts
                print(f"DEBUG: Successfully parsed {len(loaded_data_for_analysis)} rows from Supabase Excel via BytesIO.")
            except Exception as pandas_err:
                error_msg = f"ERROR: Pandas failed to read Excel bytes: {pandas_err}"
                print(error_msg)
                import traceback
                traceback.print_exc()
                return {"error": error_msg}

        except Exception as e:
            import traceback
            error_msg = f"CRITICAL ERROR: Exception during Supabase download or file processing: {e}\n{traceback.format_exc()}"
            print(error_msg)
            return {"error": error_msg}
    else:
        # Assume direct list of dictionaries (tabular data)
        # This part handles if your frontend sends: {"data": [{"col1": "val", ...}]}
        if input_data_payload and isinstance(input_data_payload, list) and all(isinstance(row, dict) for row in input_data_payload):
            loaded_data_for_analysis = input_data_payload
            try:
                df_result = pd.DataFrame(loaded_data_for_analysis)
                print(f"DEBUG: Loaded {len(loaded_data_for_analysis)} rows directly into DataFrame.")
            except Exception as e:
                error_msg = f"ERROR: Failed to create DataFrame from direct data: {e}"
                print(error_msg)
                import traceback
                traceback.print_exc()
                return {"error": error_msg}
        else:
            error_msg = "ERROR: Input data format not recognized. Expected either a Supabase Excel path or a list of dictionaries (tabular data)."
            print(error_msg)
            return {"loaded_data": [], "dataframe": None, "session_id": None, "error": error_msg}


    # --- SESSION MANAGEMENT (Applicable for both Supabase file and direct data, if df_result is valid) ---
    print(f"DEBUG: DataFrame loaded. Shape: {df_result.shape if df_result is not None else 'None'}, Is empty: {df_result.empty if df_result is not None else 'N/A'}")

    if df_result is not None and not df_result.empty:
        try:
            print("DEBUG: Starting session ID generation and storage.")
            # 1. Generate a new session ID
            session_id = str(uuid.uuid4())
            print(f"DEBUG: Generated session ID: {session_id}")

            # 2. Serialize DataFrame to Parquet in-memory
            parquet_buffer = io.BytesIO()
            df_result.to_parquet(parquet_buffer, index=False) # Save as Parquet without index
            parquet_buffer.seek(0) # Rewind buffer to the beginning
            print("DEBUG: DataFrame serialized to Parquet buffer.")

            # 3. Upload serialized DataFrame to Supabase Storage
            # Note: You changed this bucket name to 'processeddfs' (no hyphen)
            storage_bucket_name = "processeddfs" # Use the correct bucket name you noted
            df_storage_path = f"processed_data/{session_id}.parquet"
            print(f"DEBUG: Attempting to upload serialized DataFrame to Supabase Storage: bucket='{storage_bucket_name}', path='{df_storage_path}'")
            upload_res = supabase_client.storage.from_(storage_bucket_name).upload(df_storage_path, parquet_buffer.getvalue(), {"content-type": "application/octet-stream"})

            # Supabase Python client's upload method typically returns a dict on success or raises an exception/returns None/dict with error
            if upload_res and isinstance(upload_res, dict) and 'error' in upload_res and upload_res['error']:
                raise Exception(f"Supabase Storage upload error: {upload_res['error']['message']}")
            elif not upload_res: # Catch cases where upload_res is None or an empty list
                 raise Exception(f"Supabase Storage upload returned empty/falsy response: {upload_res}")

            print(f"DEBUG: Supabase Storage upload response: {upload_res}")
            print(f"DEBUG: Successfully uploaded serialized DataFrame to {df_storage_path}.")

            # 4. Save session metadata to PostgreSQL
            db_table_name = "analysis_sessions" # Ensure this is your correct table name
            session_data = {
                "session_id": session_id,
                "original_file_path": original_source_description, # From detection above
                "dataframe_storage_path": df_storage_path,
                "initial_analysis": None, # Will be updated by analyze_data_node
                "expires_at": (datetime.now() + timedelta(hours=24)).isoformat(), # Convert to ISO 8601 string
                "chat_history": [],
            }
            print(f"DEBUG: Attempting to insert session metadata into DB table '{db_table_name}' for session_id: {session_id}")
            db_insert_res = supabase_client.from_(db_table_name).insert(session_data).execute()

            # Supabase Python client's insert returns a 'data' field on success
            if not db_insert_res.data:
                raise Exception(f"Failed to insert session metadata into database. Response data: {db_insert_res.data}, Count: {db_insert_res.count}, Status: {db_insert_res.status_code}")

            print(f"DEBUG: Supabase DB insert response data: {db_insert_res.data}")
            print(f"DEBUG: Successfully stored session metadata.")

        except Exception as e:
            error_msg = f"ERROR: Failed during DataFrame serialization/storage or DB session creation: {e}"
            print(error_msg)
            import traceback
            traceback.print_exc()
            # If any part of session creation fails, return an error and None for session_id
            return {"error": error_msg, "loaded_data": [], "dataframe": None, "session_id": None}
    elif df_result is None or df_result.empty:
        error_msg = "ERROR: No data loaded or DataFrame is empty after processing. Cannot create session."
        print(error_msg)
        # If no data or empty DataFrame, explicitly return error and None session_id
        return {"error": error_msg, "loaded_data": [], "dataframe": None, "session_id": None}

    print(f"Final data loaded count for analysis: {len(loaded_data_for_analysis)}")
    # Return the loaded data, the DataFrame, and the generated session_id
    return {
        "loaded_data": loaded_data_for_analysis,
        "dataframe": df_result,
        "session_id": session_id, # This will now contain the generated UUID if successful
        "error": None
    }

async def analyze_data_node(state: AgentState) -> dict:
    """
    Analyze the tabular business data in manageable chunks.
    This node now focuses on providing an *initial summary* using chunking
    and stores it in the database for the session.
    """
    print("--- Node: analyze_data (with chunking) ---")
    data = state.get("loaded_data", [])
    session_id = state.get("session_id")

    if not data:
        print("No data found for analysis after load_data_node. Returning empty analysis.")
        return {"analysis": "No data provided for analysis."}

    # Debugging prints
    print(f"Data received by analyze_data_node (first 5 rows): {data[:5]}")
    if data:
        print(f"Keys of first data row: {list(data[0].keys())}")

    CHUNK_SIZE = 100  # number of rows per chunk (adjust as needed for token limits)

    headers = list(data[0].keys()) if data and isinstance(data[0], dict) else []

    if not headers:
        print("Warning: No headers could be extracted from the loaded data. Cannot form table string for initial summary.")
        return {"analysis": "Data loaded, but could not extract headers for initial analysis."}

    chunks = [data[i:i + CHUNK_SIZE] for i in range(0, len(data), CHUNK_SIZE)]
    combined_analysis = []

    for index, chunk in enumerate(chunks):
        print(f"🔹 Processing chunk {index + 1}/{len(chunks)} (size: {len(chunk)})")

        rows = [", ".join(headers)]
        for row in chunk:
            if isinstance(row, dict):
                row_str = ", ".join(str(row.get(h, "")) for h in headers)
                rows.append(row_str)
            else:
                print(f"Skipping malformed row in chunk {index+1}: {row} (Not a dictionary)")
                continue

        table_string = "\n".join(rows)

        print(f"Preview of table_string for chunk {index + 1} (first 200 chars):")
        print(table_string[:200])
        print("--- END PREVIEW ---")

        prompt = f"""
        You are an expert business data analyst. Analyze the following chunk of tabular business data and provide a clear, concise, and actionable summary for a non-technical business audience.

        DATA CHUNK:
        {table_string}

        Structure your analysis using:
        - Key Trends
        - Notable Changes or Patterns
        - Possible Causes or Explanations
        - Actionable Insights & Recommendations

        Be specific. Use numbers or percentages where relevant. Avoid generic advice. Keep your summary under 200 words.
        """

        try:
            result = await llm.ainvoke([HumanMessage(content=prompt)])
            chunk_analysis = result.content if hasattr(result, "content") else str(result)
            combined_analysis.append(f"Chunk {index + 1} Summary:\n{chunk_analysis}\n")
        except Exception as e:
            error_msg = f"Error processing chunk {index + 1}: {e}"
            print(error_msg)
            combined_analysis.append(f"Chunk {index + 1} Error: {error_msg}\n")

    full_analysis = "\n\n".join(combined_analysis)
    print("✅ All chunks processed. Final initial analysis assembled.")

    # --- PRODUCTION-READY SESSION MANAGEMENT (UNCOMMENT FOR PRODUCTION) ---
    if session_id:
        try:
            print(f"DEBUG: Updating initial_analysis for session {session_id} in database.")
            update_data = {"initial_analysis": full_analysis}
            db_update_res = supabase_client.from_("analysis_sessions").update(update_data).eq("session_id", session_id).execute()
            if not db_update_res.data:
                raise Exception(f"Failed to update initial analysis for session {session_id}: {db_update_res.data}")
            print(f"DEBUG: Initial analysis updated in database for session {session_id}.")
        except Exception as e:
            print(f"ERROR: Could not update initial analysis in database: {e}")
            # Do not re-raise, let the graph continue if DB update fails.
    # --- END PRODUCTION-READY SESSION MANAGEMENT ---

    return {"analysis": full_analysis}

async def categorize_insight_node(state: AgentState) -> dict:
    """
    Parses the analysis to extract key tags using a more robust method.
    """
    print("--- Node: categorize_insight ---")
    analysis_text = state.get("analysis", "")
    if not analysis_text or not isinstance(analysis_text, str):
        print("Warning: Analysis text is empty or not a string. No tags generated.")
        return {"tags": []}

    prompt = f"""
    Given the business analysis below, extract and return a concise list of high-level tags that represent the core insights.

    Analysis:
    \"\"\"{analysis_text}\"\"\"

    STRICT INSTRUCTIONS:
    - Return ONLY a valid Python list of lowercase strings, nothing else.
    - List must contain at least 3 and no more than 10 unique tags.
    - Each tag must be in snake_case format.
    - NO explanations, comments, print statements, formatting, or additional text.
    - Example of an ideal response: ["market_trends", "profitability", "customer_segmentation"]
    """

    try:
        result = await llm.ainvoke([HumanMessage(content=prompt)])
        output_text = result.content if hasattr(result, "content") else str(result)
        print(f"LLM tag raw output: '{output_text}'")

        # 1. Use regex to find the list within the model's output
        match = re.search(r'\[(.*?)\]', output_text, re.DOTALL)
        if not match:
            print("Error: Could not find a list-like structure `[...]` in the LLM output.")
            return {"tags": []}

        # 2. Extract the string that looks like a list
        list_str = match.group(0)
        print(f"Extracted list string for parsing: '{list_str}'")

        # 3. Safely parse the extracted string
        try:
            import ast
            parsed_list = ast.literal_eval(list_str)
            if isinstance(parsed_list, list):
                # 4. Clean and validate the final list
                tags = [str(item).strip() for item in parsed_list if isinstance(item, str) and item.strip()]
                print(f"Successfully parsed and cleaned tags: {tags}")
                return {"tags": tags}
            else:
                print(f"Error: Parsed data is not a list. Type: {type(parsed_list)}")
                return {"tags": []}
        except (ValueError, SyntaxError) as e:
            print(f"Error parsing the extracted list string with ast.literal_eval: {e}")
            return {"tags": []}

    except Exception as e:
        print(f"An unexpected error occurred during tag categorization: {e}")
        return {"tags": []}

async def parse_insights_node(state: AgentState) -> dict:
    print("--- Node: parse_insights (JSON Extraction) ---")
    analysis = state.get("analysis", "")
    session_id = state.get("session_id") # <-- GET SESSION_ID HERE

    if not analysis:
        print("No analysis text provided for structured insights.")
        # If no analysis, we should still try to save empty insights
        if session_id:
            try:
                supabase_client.from_("analysis_sessions").update(
                    {"categorized_insights": []}
                ).eq("session_id", session_id).execute()
                print(f"DEBUG: Updated session {session_id} with empty categorized_insights.")
            except Exception as e:
                print(f"ERROR: Failed to update session {session_id} with empty insights: {e}")
        return {"structured_insights": []}

    # Simplified, clearer prompt
    prompt = f"""Extract key business insights from this analysis and return them as a JSON object.

        Return only valid JSON in this exact format:
        {{
        "insights": [
            {{
            "label": "Revenue Growth",
            "value": "$15,000",
            "trend": "up",
            "context": "last quarter",
            "data": [
                {{"name": "Q1", "value": 5000}},
                {{"name": "Q2", "value": 10000}}
            ]
            }}
        ]
        }}

        Rules:
        - "trend" must be exactly "up", "down", or "stable"
        - "data" should contain 2-5 items with "name" (string) and "value" (number)
        - If no data breakdown exists, use empty array: []
        - Maximum 5 insights
        - Return only the JSON, no other text

        Analysis to extract from:
        {analysis}"""

    try:
        # Use ChatTogether properly
        resp = await llm.ainvoke([HumanMessage(content=prompt)])
        content = resp.content.strip() if hasattr(resp, "content") else str(resp).strip()

        print(f"Raw LLM response length: {len(content)}")
        print(f"Raw LLM response (first 500 chars): {content[:500]}")

        # More robust JSON extraction
        json_str = extract_json_from_text(content)
        if not json_str:
            print("Could not extract JSON from response")
            final_insights = [] # Default to empty list
        else:
            print(f"Extracted JSON string: {json_str}")

            # Parse and validate
            data = json.loads(json_str)

            # Validate structure
            if not isinstance(data, dict) or "insights" not in data:
                print("Invalid JSON structure - missing 'insights' key")
                final_insights = [] # Default to empty list
            else:
                insights = data["insights"]
                if not isinstance(insights, list):
                    print("Invalid JSON structure - 'insights' is not a list")
                    final_insights = [] # Default to empty list
                else:
                    # Validate each insight
                    validated_insights = []
                    for i, insight in enumerate(insights):
                        if not isinstance(insight, dict):
                            print(f"Skipping insight {i}: not a dict")
                            continue

                        # Check required fields
                        required_fields = ["label", "value", "trend", "context", "data"]
                        if not all(field in insight for field in required_fields):
                            print(f"Skipping insight {i}: missing required fields")
                            continue

                        # Validate trend
                        if insight["trend"] not in ["up", "down", "stable"]:
                            print(f"Fixing invalid trend for insight {i}: {insight['trend']}")
                            insight["trend"] = "stable"  # Default fallback

                        # Validate data array
                        if not isinstance(insight["data"], list):
                            insight["data"] = []

                        validated_insights.append(insight)

                    print(f"Successfully validated {len(validated_insights)} insights")
                    final_insights = validated_insights # Store the valid insights

        # --- NEW: Store validated insights in Supabase ---
        if session_id:
            try:
                print(f"DEBUG: Attempting to update categorized_insights for session {session_id} in database.")
                update_res = supabase_client.from_("analysis_sessions").update(
                    {"categorized_insights": final_insights} # Save the final_insights
                ).eq("session_id", session_id).execute()

                if update_res.data:
                    print(f"DEBUG: Categorized insights for session {session_id} updated successfully in DB.")
                else:
                    print(f"ERROR: Failed to update categorized_insights for session {session_id} in DB. Details: {update_res.error}")

            except Exception as e:
                print(f"ERROR: Could not update categorized_insights in database: {e}")
                # Do not re-raise, let the graph continue if DB update fails.
        # --- END NEW ---

        return {"structured_insights": final_insights} # Ensure the node always returns structured_insights

    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        print(f"Problematic JSON: {json_str if 'json_str' in locals() else 'Not extracted'}")
        final_insights = [] # Default to empty on error
        # Still attempt to save empty insights if parsing fails
        if session_id:
            try:
                supabase_client.from_("analysis_sessions").update(
                    {"categorized_insights": final_insights}
                ).eq("session_id", session_id).execute()
                print(f"DEBUG: Updated session {session_id} with empty categorized_insights due to JSON error.")
            except Exception as e:
                print(f"ERROR: Failed to update session {session_id} with empty insights after JSON error: {e}")
        return {"structured_insights": final_insights}
    except Exception as e:
        print(f"Error in parse_insights_node: {e}")
        import traceback
        traceback.print_exc()
        final_insights = [] # Default to empty on error
        # Still attempt to save empty insights if any other error occurs
        if session_id:
            try:
                supabase_client.from_("analysis_sessions").update(
                    {"categorized_insights": final_insights}
                ).eq("session_id", session_id).execute()
                print(f"DEBUG: Updated session {session_id} with empty categorized_insights due to general error.")
            except Exception as e:
                print(f"ERROR: Failed to update session {session_id} with empty insights after general error: {e}")
        return {"structured_insights": final_insights}


def extract_json_from_text(text: str) -> str:
    """
    Extracts JSON from text using multiple strategies.
    Returns the JSON string or empty string if not found.
    """
    # Strategy 1: Look for JSON code blocks
    import re
    
    # Remove common markdown code blocks
    code_block_patterns = [
        r'```json\s*(.*?)\s*```',
        r'```\s*(.*?)\s*```',
    ]
    
    for pattern in code_block_patterns:
        matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
        if matches:
            candidate = matches[0].strip()
            if candidate.startswith('{') and candidate.endswith('}'):
                return candidate
    
    # Strategy 2: Find JSON-like structure (from first { to last })
    first_brace = text.find('{')
    last_brace = text.rfind('}')
    
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace:last_brace + 1]
        # Quick validation - count braces
        open_count = candidate.count('{')
        close_count = candidate.count('}')
        if open_count == close_count:
            return candidate
    
    # Strategy 3: Try to find JSON array or object patterns
    json_patterns = [
        r'(\{[^}]*"insights"[^}]*\[[^\]]*\][^}]*\})',
        r'(\{.*?"insights".*?\})',
    ]
    
    for pattern in json_patterns:
        matches = re.findall(pattern, text, re.DOTALL)
        if matches:
            return matches[0]
    
    return ""

async def respond_node(state: AgentState) -> dict:
    """
    Formates the final response based on the analysis.
    """
    print("--- Node: respond ---")
    response_text = state.get("analysis", "⚠️ No analysis available.")
    print(f"Final response generated.")
    return {"response": response_text}

# --- 6. Graph Definition ---
# The structure of the graph remains the same.
builder = StateGraph(AgentState)

builder.add_node("load_data", load_data_node)
builder.add_node("analyze_data", analyze_data_node)
builder.add_node("categorize_insight", categorize_insight_node)
builder.add_node("parse_insights", parse_insights_node)
builder.add_node("respond", respond_node)

builder.set_entry_point("load_data")
builder.add_edge("load_data", "analyze_data")
builder.add_edge("analyze_data", "categorize_insight")
builder.add_edge("categorize_insight", "parse_insights")
builder.add_edge("parse_insights", "respond")      
builder.set_finish_point("respond")

# Compile the graph into a runnable object
graph = builder.compile()

app = FastAPI(
    title="Business Data Analyst AI",
    description="An AI agent to analyze business data from Excel files uploaded to Supabase Storage and answer follow-up questions.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class InvokeRequest(BaseModel):
    data: List[Dict[str, Any]]
    config: Optional[Dict[str, Any]] = None # Not currently used by the graph, but for future extensibility

class InvokeResponse(BaseModel):
    session_id: Optional[str] = None # Make session_id optional with a default of None
    analysis: str
    insights: List[Dict[str, Any]]
    tags: List[str]
    response: str
    error: Optional[str] = None

class ChatRequest(BaseModel):
    session_id: str
    question: str
    history: List[Dict[str, str]]

class ChatResponse(BaseModel):
    response: str


@app.post("/invoke", response_model=InvokeResponse)
async def invoke_graph(payload: InvokeRequest) -> InvokeResponse:
    """
    Invokes the LangGraph workflow to process and analyze the provided data.
    Starts a new analysis session and stores the DataFrame for follow-up questions.
    """
    try:
        # Initial state for the graph run
        inputs = {
            "data": payload.data,
            "analysis": "", "response": "", "tags": [],
            "structured_insights": [], "error": None,
            "loaded_data": [], "dataframe": None, "session_id": None # session_id will be populated by load_data_node
        }
        print("\n🚀 Starting new graph invocation...")
        final_state = await graph.ainvoke(inputs)
        print("✅ Graph invocation complete.")

        # --- PRODUCTION-READY SESSION MANAGEMENT (UNCOMMENT FOR PRODUCTION) ---
        # Instead of global variables, client would use the session_id to retrieve data.
        # This part is for *testing* the full flow during development without DB integration *initially*.
        global global_last_processed_df
        global global_last_processed_analysis
        global global_current_session_id

        if final_state.get("dataframe") is not None:
            global_last_processed_df = final_state.get("dataframe")
            global_last_processed_analysis = final_state.get("analysis", "")
            global_current_session_id = final_state.get("session_id")
            print(f"DEBUG: Stored last processed DF, analysis, and session ID: {global_current_session_id} in globals for dev testing.")
        # --- END PRODUCTION-READY SESSION MANAGEMENT ---


        # Return the session_id in the response for the frontend to use
        session_id_returned = final_state.get("session_id", "NO_SESSION_ID") # Fallback for error cases

        return InvokeResponse(
            session_id=session_id_returned, # IMPORTANT: Pass this back to frontend
            analysis=final_state.get("analysis", ""),
            insights=final_state.get("structured_insights", []),
            tags=final_state.get("tags", []),
            response=final_state.get("response", ""),
            error=final_state.get("error")
        )
    except Exception as e:
        import traceback
        print(f"Unhandled error during graph invocation: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/chat", response_model=ChatResponse)
async def chat_with_insight(payload: ChatRequest) -> ChatResponse:
    """
    Allows asking follow-up questions about the last analyzed spreadsheet data.
    Uses a Pandas DataFrame Agent, retrieving the DataFrame from Supabase Storage.
    Persists chat history in Supabase.
    """
    session_id = payload.session_id
    user_question = payload.question
    # We will use the history from the DB for the agent's memory,
    # but the payload.history is useful for immediate frontend updates.

    current_df: Optional[pd.DataFrame] = None
    initial_analysis_context: str = ""
    existing_db_history: List[Dict[str, str]] = [] # Initialize for scope

    # --- PRODUCTION-READY SESSION MANAGEMENT ---
    try:
        print(f"DEBUG: Fetching session {session_id} from database...")
        db_fetch_res = supabase_client.from_("analysis_sessions").select("*").eq("session_id", session_id).single().execute()

        if not db_fetch_res.data:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found or expired.")

        session_data = db_fetch_res.data
        df_storage_path = session_data["dataframe_storage_path"]
        initial_analysis_context = session_data.get("initial_analysis", "") # Get initial summary
        existing_db_history = session_data.get("chat_history", []) # Retrieve existing chat history

        print(f"DEBUG: Downloading DataFrame from Supabase Storage: {df_storage_path}")
        df_bytes = supabase_client.storage.from_("processeddfs").download(df_storage_path)

        if not df_bytes:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve DataFrame from storage for session {session_id}.")

        current_df = pd.read_parquet(io.BytesIO(df_bytes))
        print(f"DEBUG: Successfully loaded DataFrame for session {session_id}. Shape: {current_df.shape}")

    except HTTPException as he:
        raise he # Re-raise HTTP exceptions directly
    except Exception as e:
        print(f"ERROR: Failed to retrieve session data or DataFrame for chat: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error retrieving session context: {str(e)}")
    # --- END PRODUCTION-READY SESSION MANAGEMENT ---

    # --- DEVELOPMENT/GLOBAL VARIABLE FALLBACK (COMMENT OUT IN PRODUCTION) ---
    if current_df is None: # Fallback if DB fetch is commented out or fails in dev
        global global_last_processed_df
        global global_last_processed_analysis
        global global_current_session_id
        if session_id == global_current_session_id and global_last_processed_df is not None:
            current_df = global_last_processed_df
            initial_analysis_context = global_last_processed_analysis
            print("DEBUG: Using global DataFrame for chat (development mode).")
        else:
            raise HTTPException(status_code=400, detail="No data context available for chat. Please upload and invoke analysis first via /invoke.")
    # --- END DEVELOPMENT/GLOBAL VARIABLE FALLBACK ---

    try:
        # 1. Prepare chat history for LangChain Memory
        # Convert stored history (list of dicts) to LangChain's BaseMessage objects
        messages_for_memory = []

        # Add initial analysis as a SystemMessage at the very beginning of memory
        if initial_analysis_context:
            messages_for_memory.append(SystemMessage(content=f"Initial Data Analysis: {initial_analysis_context}"))

        for msg in existing_db_history:
            if msg['role'] == 'user':
                messages_for_memory.append(HumanMessage(content=msg['content']))
            elif msg['role'] == 'assistant':
                messages_for_memory.append(AIMessage(content=msg['content']))

        chat_history_instance = ChatMessageHistory(messages=messages_for_memory)

        # Initialize ConversationBufferMemory with the loaded history
        memory = ConversationBufferMemory(
            chat_memory=chat_history_instance, # <-- Pass the ChatMessageHistory instance here
            memory_key="chat_history",
            return_messages=True
        )

        # 2. Construct the system message for the agent (without initial_analysis_context)
        # We are removing the initial_analysis_context from the prefix because memory handles it.
        # This is crucial to avoid potential prompt variable conflicts.
        system_message_content = f"""
        You are an expert data analyst assistant with access to a Pandas DataFrame. Your role is to help users understand and analyze their data through comprehensive, insightful responses that provide both answers and context.

        ## Core Principles
        - **Be thorough**: Always provide complete answers with supporting details and context
        - **Explain your reasoning**: Don't just state results - explain what the data shows and why it matters
        - **Add value**: Go beyond basic answers to provide insights that help users understand their data better
        - **Be specific**: Use concrete numbers, percentages, and comparisons to make your points clear

        ## Your Approach
        When responding to user questions:

        1. **Analyze the question**: Understand both the explicit question and the underlying business need
        2. **Plan comprehensively**: Consider what context and supporting information would be valuable
        3. **Execute thoroughly**: Gather primary data plus relevant supporting metrics
        4. **Provide rich answers**: Present findings with explanations, context, and actionable insights

        ## Response Requirements
        Your responses must include:
        - **Direct answer** to the question asked
        - **Supporting evidence** from the data (specific numbers, trends, comparisons)
        - **Context** that explains why this answer matters or what it means for the user
        - **Additional insights** that might be relevant (trends, patterns, anomalies)

        ## Response Format
        Use this structure for comprehensive responses:

        **Understanding:** [Restate the question and explain what insights you'll provide]

        **Analysis:**
        Thought: [What do I need to find in the data to give a complete answer?]
        Action: [tool_name]
        Action Input: [executable_code]
        Observation: [tool_output]

        [Repeat Analysis steps as needed - gather primary data AND supporting context]

        **Answer:** 
        [Primary answer with specific details]

        **Context & Insights:**
        - [Supporting metrics and comparisons]
        - [Trends or patterns observed]
        - [Business implications or recommendations where appropriate]
        - [Any caveats or limitations to consider]

        ## Example of Good vs. Poor Responses

        ❌ **Poor Response (too brief):**
        "Widget A is the best performing product."

        ✅ **Good Response (comprehensive):**
        "Widget A is the best performing product with $1,245,678 in total revenue, representing 34% of all product sales. This is 23% higher than the second-best performer (Widget B at $1,012,456). Widget A has shown consistent growth over the past 6 months, with particularly strong performance in Q2. It also has the highest profit margin at 28%, making it both a top revenue generator and highly profitable."

        ## Guidelines
        - Never give single-sentence answers without explanation
        - Always include specific numbers and metrics to support your conclusions
        - Compare results to relevant benchmarks (other products, time periods, averages)
        - If you notice interesting patterns or anomalies, mention them
        - Use clear formatting for numbers (e.g., "$1,234.56", "45.2%")
        - If data is incomplete, explain what's missing and provide the best analysis possible
        - When appropriate, suggest follow-up questions or additional analyses that might be valuable

        ## Error Handling
        - If data is insufficient, explain what information would be needed for a complete answer
        - If there are multiple ways to interpret "best performing," analyze the most relevant metrics
        - Always base conclusions on actual data, never make assumptions

        Now, please help the user analyze their data by providing comprehensive, insightful responses that go well beyond simple answers.
        """

        # 3. Initialize the Pandas DataFrame Agent with memory
        pandas_agent = create_pandas_dataframe_agent(
            llm,
            current_df,
            verbose=True,
            allow_dangerous_code=True,
            agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
            max_iterations=15,
            agent_executor_kwargs={
                "handle_parsing_errors": True,
                "memory": memory, # <-- Pass the memory object here
            },
            # The prefix will contain the static instructions.
            # History and initial analysis are now handled by the 'memory' object.
            prefix=system_message_content
        )

        print(f"\n💬 Invoking Pandas DataFrame Agent for chat question: '{user_question}'")

        # 4. Invoke the agent. The memory will automatically add history to the prompt.
        response = await pandas_agent.ainvoke({
            "input": user_question,
            # Do NOT pass "chat_history" or "history" directly here, memory handles it.
            # Do NOT pass "id" here, as it caused issues.
        })

        response_content = response.get("output", "I could not process your request with the available data or found no relevant information.")
        print("✅ Pandas Agent response received.")

        # 5. Update the chat history in the database
        # Append the current user question and AI response to the history
        updated_db_history = existing_db_history + [
            {"role": "user", "content": user_question},
            {"role": "assistant", "content": response_content}
        ]

        # Store the updated history back into Supabase
        update_res = supabase_client.from_("analysis_sessions").update(
            {"chat_history": updated_db_history}
        ).eq("session_id", session_id).execute()

        if update_res.data:
            print(f"DEBUG: Chat history for session {session_id} updated successfully in DB.")
        else:
            print(f"ERROR: Failed to update chat history for session {session_id} in DB. Details: {update_res.error}")

        return ChatResponse(response=response_content)

    except Exception as e:
        print(f"Error during Pandas Agent chat: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing chat question: {str(e)}")
    

@app.get("/session/{session_id}", response_model=SessionDataResponse)
async def get_session_data(session_id: str):
    """
    Fetches all relevant data for a specific session, including its chat history and categorized insights.
    """
    try:
        print(f"DEBUG: Fetching all session data for session_id: {session_id}")
        db_fetch_res = supabase_client.from_("analysis_sessions").select(
            "session_id, dataframe_storage_path, initial_analysis, chat_history, categorized_insights" # <-- ADDED categorized_insights HERE
        ).eq("session_id", session_id).single().execute()

        if not db_fetch_res.data:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

        session_data = db_fetch_res.data

        # Ensure chat_history is a list, defaulting to empty if null/missing
        chat_history_from_db = session_data.get("chat_history", [])
        if not isinstance(chat_history_from_db, list):
            print(f"WARNING: chat_history for session {session_id} is not a list. Returning empty list.")
            chat_history_from_db = []

        # Ensure categorized_insights is a list, defaulting to empty if null/missing
        categorized_insights_from_db = session_data.get("categorized_insights", []) # Get the actual data
        if not isinstance(categorized_insights_from_db, list): # Add a check for type safety
            print(f"WARNING: categorized_insights for session {session_id} is not a list. Returning empty list.")
            categorized_insights_from_db = []

        return SessionDataResponse(
            session_id=session_data["session_id"],
            dataframe_storage_path=session_data["dataframe_storage_path"],
            initial_analysis=session_data.get("initial_analysis"),
            chat_history=chat_history_from_db,
            categorized_insights=categorized_insights_from_db, # <-- Return the fetched data
        )

    except Exception as e:
        print(f"ERROR: Failed to fetch session data for {session_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching session data: {str(e)}")


@app.get("/sessions", response_model=AllSessionsResponse) # Note the new path: /sessions (plural)
async def get_all_sessions():
    """
    Fetches all session data from the database.
    """
    try:
        print("DEBUG: Attempting to fetch all sessions from database.")
        # Select all columns. If you only need a subset for the history list (e.g., ID, creation date, file name),
        # you can specify them like: "session_id, original_file_path, created_at"
        db_fetch_res = supabase_client.from_("analysis_sessions").select(
            "session_id, original_file_path, created_at, initial_analysis, categorized_insights, chat_history, dataframe_storage_path"
        ).order("created_at", desc=True).execute() # Order by creation date, newest first

        if not db_fetch_res.data:
            print("DEBUG: No sessions found in the database.")
            return AllSessionsResponse(sessions=[]) # Return an empty list if no data

        # Map the raw Supabase data to your Pydantic model
        all_sessions = []
        for session_data_raw in db_fetch_res.data:
            # Ensure proper typing and defaults for fields that might be null or missing
            chat_history = session_data_raw.get("chat_history", [])
            if not isinstance(chat_history, list):
                chat_history = []

            categorized_insights = session_data_raw.get("categorized_insights", [])
            if not isinstance(categorized_insights, list):
                categorized_insights = []

            all_sessions.append(
                SessionDataResponse(
                    session_id=session_data_raw["session_id"],
                    initial_analysis=session_data_raw.get("initial_analysis", ""),
                    categorized_insights=categorized_insights,
                    chat_history=chat_history,
                    dataframe_storage_path=session_data_raw.get("dataframe_storage_path", "") # Ensure this is retrieved
                    # If you have 'created_at' in your DB and SessionDataResponse, add it here too
                    # created_at=session_data_raw.get("created_at")
                )
            )
        
        print(f"DEBUG: Successfully fetched {len(all_sessions)} sessions.")
        return AllSessionsResponse(sessions=all_sessions)

    except Exception as e:
        print(f"ERROR: Failed to fetch all sessions: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching all sessions: {str(e)}")