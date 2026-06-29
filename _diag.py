import os, time
from dotenv import load_dotenv
load_dotenv("/home/sophie/SokoSense/SokoSense/.env")
from langchain_openai import ChatOpenAI

key = os.getenv("FEATHERLSS_API_KEY")
model = os.getenv("LLM_MODEL_FEATHERLESS", "deepseek-ai/DeepSeek-V4-Flash")
print("model:", model, "| key set:", bool(key))

llm = ChatOpenAI(
    model=model,
    temperature=0,
    openai_api_key=key,
    openai_api_base="https://api.featherless.ai/v1",
    timeout=30,
    max_retries=0,
)
t = time.time()
try:
    r = llm.invoke("Say OK")
    print("LLM replied in %.1fs:" % (time.time() - t), repr(r.content[:200]))
except Exception as e:
    print("LLM ERROR after %.1fs:" % (time.time() - t), type(e).__name__, str(e)[:500])
