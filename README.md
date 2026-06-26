# QueueStorm Investigator
### bKash presents SUST CSE Carnival 2026 — Codex Community Hackathon
**AI/API SupportOps Challenge · Online Preliminary**

---

## What It Does

QueueStorm Investigator is an internal AI copilot for digital finance support agents. It receives one customer complaint at a time alongside the customer's recent transaction history, investigates whether the data supports or contradicts the complaint, and returns a structured JSON response that classifies, routes, and explains the case — ready for the support agent to act on.

It is **not** a classifier. It is an investigator. The complaint says one thing. The data may say another. This service decides what is true.

---

## Live Endpoint

```
Base URL: https://queuestorm-dkli.onrender.com

GET  /health          → {"status":"ok"}
POST /analyze-ticket  → structured JSON analysis
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API Framework | FastAPI + Uvicorn |
| AI/LLM | Groq API — llama-3.3-70b-versatile |
| Safety Layer | Rule-based Python (deterministic, no LLM) |
| Evidence Logic | Hybrid: deterministic verdict override + LLM reasoning |
| Deployment | Render (free tier, auto-deploy from GitHub) |
| Language | Python 3.11+ |

---

## Setup & Run

### 1. Clone the repository
```bash
git clone https://github.com/YOURNAME/queuestorm.git
cd queuestorm
```

### 2. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set environment variables
```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### 5. Run the service
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 6. Test health
```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| GROQ_API_KEY | Yes | API key from console.groq.com |

See `.env.example` for the template.

---

## API Usage

### GET /health
```bash
curl https://queuestorm-dkli.onrender.com/health
```
Response:
```json
{"status": "ok"}
```

### POST /analyze-ticket
```bash
curl -X POST https://queuestorm-dkli.onrender.com/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TKT-001",
    "complaint": "I sent 5000 taka to a wrong number around 2pm today",
    "language": "en",
    "transaction_history": [{
      "transaction_id": "TXN-9101",
      "timestamp": "2026-04-14T14:08:22Z",
      "type": "transfer",
      "amount": 5000,
      "counterparty": "+8801719876543",
      "status": "completed"
    }]
  }'
```

---

## AI & Model Usage

**Model:** `llama-3.3-70b-versatile` via Groq API

**Why Groq + Llama 3.3 70B:**
- Sub-second inference — well within the 30-second per-request timeout
- Strong multilingual performance for English, Bangla, and Banglish complaints
- Free tier sufficient for evaluation volume
- No GPU required, no large local model weights

**Approach — Hybrid Rule + AI:**

The system uses a two-layer architecture:

1. **LLM Layer (Groq):** Understands complaint intent, extracts relevant context, classifies case type, generates agent summary, recommended next action, and customer reply.

2. **Deterministic Layer (Python rules):** Overrides LLM decisions for evidence verdict logic. If a customer claims they sent money but the transaction shows `failed`, the system deterministically returns `inconsistent` regardless of what the LLM says. This ensures the investigator twist is handled correctly and consistently.

**Why not pure rules?** Natural language complaints in Bangla/Banglish/English with varying phrasing cannot be reliably handled by keyword matching alone. LLM handles language understanding; rules handle correctness.

---

## Safety Logic

All safety checks run **after** the LLM response, in a deterministic Python layer that cannot be overridden by prompt injection.

| Rule | Implementation |
|---|---|
| Never ask for PIN/OTP/password | Regex scan of `customer_reply`; full reply replaced if violated |
| Never confirm refund/reversal directly | Regex scan; unsafe language replaced with official-channels phrasing |
| Never direct to suspicious third parties | LLM system prompt + output scan |
| Prompt injection in complaint text | System prompt instructs LLM to ignore; complaint treated as data only |
| Force human review for risky cases | Deterministic: wrong_transfer, phishing, duplicate_payment, high/critical severity, inconsistent evidence all set `human_review_required: true` |

**Safety violations cannot pass through** because the safety layer runs on the final output, not inside the LLM.

---

## Evidence Reasoning

The core investigator logic cross-references the complaint against transaction history:

```
Customer claims sent money + transaction status = failed  → inconsistent
Customer claims sent money + transaction status = completed → consistent  
No matching transaction in history                         → insufficient_data
Transaction status = pending                               → insufficient_data
```

This deterministic override ensures the system never confidently confirms something the data contradicts.

---

## Known Limitations

- **Groq rate limits:** Under very high concurrency, Groq free tier may throttle. The service returns a 500 with a non-sensitive error message rather than crashing.
- **Banglish coverage:** Mixed romanized Bengali is handled by the LLM but edge cases with heavy dialect variation may reduce classification accuracy.
- **Amount matching:** The evidence logic matches by transaction status and complaint keywords, not by exact amount cross-reference. A complaint about 5000 BDT with a 3000 BDT transaction in history may still be linked if it's the only transfer.
- **No persistent state:** Each ticket is analyzed independently. No conversation history or session state is maintained.
- **Single transaction matching:** The service identifies the most relevant transaction but does not handle cases where multiple transactions are all relevant (e.g. duplicate payment across two transaction IDs).

---

## MODELS

| Model | Provider | Where it runs | Why chosen |
|---|---|---|---|
| llama-3.3-70b-versatile | Groq (Meta Llama) | Groq cloud inference | Fast, accurate, multilingual, free tier available, no GPU needed |

No local models. No model weights in repository or Docker image.

---

## Repository Structure

```
queuestorm/
├── main.py          # FastAPI app, endpoints, error handling
├── analyzer.py      # Groq integration, prompt, validation, evidence logic
├── safety.py        # Deterministic safety rule enforcement
├── requirements.txt # Minimal dependencies
├── .env.example     # Environment variable template
└── README.md        # This file
```

---

## Sample Request & Response

See `sample_output.json` in this repository for a fully worked example matching the public sample case format.

---

## Synthetic Data Confirmation

All complaints and transaction histories used during development and testing are synthetic. No real customer data, no real payment system integration, no production APIs were used.

No real secrets are committed to this repository at any time.
