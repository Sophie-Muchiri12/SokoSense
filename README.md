# SokoSense - KAMIS Market Price Agent

SokoSense is an AI-powered agricultural agent built with LangChain, LangGraph, and Groq LLM. It queries the Kenya Agricultural Market Information System (KAMIS) directly and answers natural language pricing questions, returning structured, clean JSON responses for crop prices in Kenya.

## Features
- **Multi-crop / Variety Resolution**: Resolves broad crop queries (e.g., "maize") into specific product varieties (e.g., "Dry Maize", "Green Maize", "Maize Flour") automatically.
- **Robust Case Insensitivity**: Processes crop names and locations regardless of how they are capitalized (e.g., `dRy MAiZe kAkAmEgA`).
- **Adaptive Page Sizing**: Smart pagination (`per_page=10` by default to prevent overloading the server; `per_page=100` dynamically when location filtering is needed).
- **Dual-Layer Rate Limiting**: Built-in sliding-window rate limiting (max 5 requests/minute) for both user queries and outgoing KAMIS server requests.
- **Structured JSON Response**: Returns a clean JSON block mapping crops to their wholesale/retail prices, county, market, and date.
- **Fail-safe Search fallback**: Uses Tavily API to look up broader agricultural context on the KAMIS domain if direct scraping returns no data.

---

## Installation & Setup

1. **Clone the repository** (or navigate to the project folder):
   ```bash
   cd SokoSense
   ```

2. **Initialize a virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   *(Ensure you have `pandas`, `beautifulsoup4`, `lxml`, `requests`, `langchain`, `langgraph`, `langchain-groq`, `tavily-python`, and `python-dotenv` installed).*

4. **Configure Environment Variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Fill in your credentials:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   ```

---

## How to Run

You can run SokoSense in two ways:

### 1. Single-Shot CLI Query
Pass your query directly as a command-line argument:
```bash
python index.py "maize nairobi"
```

### 2. Interactive CLI Mode
Run the script without arguments to enter an interactive session:
```bash
python index.py
```
You can then ask questions sequentially:
```text
Welcome to the SokoSense KAMIS Market Price Agent!
Type your query below (e.g. 'What is the price of Tomatoes in Meru county?')
Type 'exit' or 'quit' to close.

Ask SokoSense> What is the price of tomatoes in Meru?
...
```

---

## Example JSON Output

When querying for prices in a location, SokoSense outputs a structured JSON block:

```json
{
  "location": "Nairobi",
  "date": "2026-06-15",
  "prices": [
    {
      "commodity": "Dry Maize",
      "market": "Kawangware",
      "wholesale": "55.00/Kg",
      "retail": "65.00/Kg",
      "county": "Nairobi"
    },
    {
      "commodity": "Maize Flour",
      "market": "Nairobi Supermarkets",
      "wholesale": "-",
      "retail": "79.50/Kg",
      "county": "Nairobi"
    }
  ]
}
```
