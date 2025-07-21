from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
import os

llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
msg = HumanMessage(content="Hello, summarize this text: Sales increased.")
res = llm.invoke([msg])
print(res.content)