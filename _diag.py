import os, time
from dotenv import load_dotenv
load_dotenv("/home/sophie/SokoSense/SokoSense/.env")
from engines.llm import DEFAULT_GROQ_MODEL, get_groq_llm

key = os.getenv("GROQ_API_KEY")
print("model:", DEFAULT_GROQ_MODEL, "| key set:", bool(key))

llm = get_groq_llm(temperature=0)
if llm is None:
    print("GROQ_API_KEY not set")
    raise SystemExit(1)

t = time.time()
try:
    r = llm.invoke("Say OK")
    print("LLM replied in %.1fs:" % (time.time() - t), repr(r.content[:200]))
except Exception as e:
    print("LLM ERROR after %.1fs:" % (time.time() - t), type(e).__name__, str(e)[:500])
