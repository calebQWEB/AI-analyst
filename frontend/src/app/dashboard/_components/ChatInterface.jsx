"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const ChatInterface = () => {
  // Initialize messages as empty, as they will be loaded from history
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // For sending new messages
  const [isLoadingHistory, setIsLoadingHistory] = useState(true); // For initial history load

  const params = useParams();
  const sessionId = params.sessionId; // Get sessionId from Next.js URL params

  const backendBaseUrl = "http://localhost:8000"; // Your FastAPI backend URL

  // Function to fetch initial session data including chat history
  const fetchSessionData = async () => {
    if (!sessionId) {
      // If no session ID, display a message and stop loading
      setMessages([
        {
          role: "system",
          text: "No session ID found. Please upload your data first to start an analysis session.",
        },
      ]);
      setIsLoadingHistory(false);
      return;
    }

    setIsLoadingHistory(true); // Start loading indicator for history
    try {
      const response = await fetch(`${backendBaseUrl}/session/${sessionId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error fetching session data:", errorText);
        throw new Error(`Failed to load session data: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched Session Data:", data);

      // Initialize messages with fetched chat_history
      // Add an initial system message if the history is empty
      const initialSystemMessage = {
        role: "system",
        text: "Ask me anything about your business data.",
      };
      const loadedMessages = data.chat_history || [];
      setMessages([initialSystemMessage, ...loadedMessages]);

      // Optionally, if you still need the initial analysis for display on the frontend
      // setAnalysis(data.initial_analysis);
    } catch (error) {
      console.error("Error fetching session data:", error);
      setMessages([
        {
          role: "system",
          text: "Error loading conversation history. Please try again later.",
        },
      ]);
    } finally {
      setIsLoadingHistory(false); // End loading indicator for history
    }
  };

  // useEffect to load session data when the component mounts or sessionId changes
  useEffect(() => {
    fetchSessionData();
  }, [sessionId]); // Dependency array: re-run if sessionId changes

  // SEND CHAT FUNCTION
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || isLoadingHistory || !sessionId) {
      if (!sessionId) {
        alert(
          "No active session. Please upload your data and start an analysis first."
        );
      }
      return;
    }

    const userMessage = { role: "user", text: input }; // Keep 'text' here
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const formattedHistory = newMessages.map((msg) => ({
        role: msg.role,
        content: msg.text, // <--- IMPORTANT: Ensure your backend ChatRequest expects 'content' for history messages
      }));

      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.text, // <--- CHANGE THIS LINE FROM .content TO .text
          session_id: sessionId,
          history: formattedHistory,
        }),
      });

      let data;
      try {
        data = await res.json();
        if (!res.ok) {
          console.error("Backend chat error:", data);
          throw new Error(data.detail || "Unknown backend error");
        }
      } catch (jsonError) {
        console.error("Error parsing chat response JSON:", jsonError);
        data = { response: "⚠️ Unexpected server response or empty response." };
      }

      const responseText = data.response || "No response generated.";
      const aiMessage = { role: "assistant", text: responseText };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error communicating with backend:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `⚠️ Something went wrong: ${
            error.message || "Unknown error"
          }. Please try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Left: Chat */}
      <div className="w-full md:w-2/3 border-r md:border-r p-4 md:p-6 flex flex-col min-h-screen bg-white">
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4 md:mb-6 pb-2 border-b border-gray-100">
          <span className="text-blue-600">AI</span> Analyst Chat
        </h2>

        {/* Message Display Area */}
        <div className="flex-1 space-y-3 md:space-y-4 overflow-y-auto pr-1 md:pr-3 scrollbar-thumb-rounded scrollbar-track-blue-100 scrollbar-thumb-blue-300 scrollbar-w-2">
          {isLoadingHistory ? (
            <div className="text-gray-500 text-center py-10">
              Loading conversation history...
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 md:p-4 rounded-xl max-w-[95%] md:max-w-[70%] shadow-sm text-gray-800 break-words leading-relaxed
                                ${
                                  msg.role === "user"
                                    ? "bg-blue-600 text-white ml-auto rounded-br-none"
                                    : "bg-gray-100 text-gray-900 rounded-bl-none"
                                }
                            `}
                style={{
                  filter:
                    msg.role === "user"
                      ? "drop-shadow(2px 2px 4px rgba(0,0,0,0.1))"
                      : "drop-shadow(1px 1px 2px rgba(0,0,0,0.05))",
                }}
              >
                {msg.text || msg.content}
              </div>
            ))
          )}
          {/* Spacer to push messages up */}
          <div className="h-2 md:h-4"></div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSend}
          className="fixed bottom-10 md:w-[64%] mt-4 md:mt-6 flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-3 items-stretch md:items-center"
        >
          <div className="relative flex-1">
            <input
              type="text"
              className="flex-1 w-full border border-gray-300 rounded-xl px-4 md:px-5 py-3 pr-10 md:pr-12 text-gray-800 placeholder-gray-400
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                    transition duration-200 ease-in-out shadow-sm text-base"
              placeholder="Ask a question about your data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading || isLoadingHistory} // Disable input when loading
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white font-semibold px-5 md:px-6 py-3 rounded-xl shadow-md
                                    hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                    transition duration-300 ease-in-out transform hover:scale-105"
            disabled={loading || isLoadingHistory} // Disable button when loading
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatInterface;
