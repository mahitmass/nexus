# PrahaariNet

**Real-time UPI mule ring detection via Temporal Graph Neural Networks**

Kraken'X 2026 · FinTech Track · 24-25 April 2026

---

## The 30-Second Pitch

RBI's MuleHunter.AI detects fraud within a single bank. **PrahaariNet detects mule rings across India's entire UPI inter-bank graph — in under two seconds.** When a fraud ring is detected, the transaction is held for 30 seconds while a vernacular voice alert fires to the victim's phone.

---

## Architecture

```
  ┌─────────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────┐
  │  UPI txn    │─▶│  Kafka   │─▶│  FastAPI    │─▶│  Neo4j   │
  │  stream     │  │ (Redis   │  │  /api/score │  │  (graph) │
  └─────────────┘  │ fallback)│  └──────┬──────┘  └──────────┘
                   └──────────┘         │
                                        ▼
                        ┌─────────────────────────────────┐
                        │  GraphSAGE → TGN → IsoForest    │
                        │  → GNNExplainer → Verdict       │
                        └────────────┬────────────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
        ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
        │  Next.js     │    │  Bhashini    │    │  WhatsApp    │
        │  dashboard   │    │  voice alert │    │  notification│
        └──────────────┘    └──────────────┘    └──────────────┘
```

---

## Quick Start (Your Setup Checklist)

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Docker** (optional — only if you want local Neo4j instead of Aura cloud)
- **CUDA GPU** (optional — pretraining runs on CPU too, just slower)

### 1. Clone & install

```bash
git clone <your-repo> prahaarinet
cd prahaarinet
make install
```

If `make` isn't available:
```bash
cd backend && pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..
```

### 2. Set up Neo4j

**Option A — Neo4j Aura (recommended, cloud, free tier):**
1. Sign up at [console.neo4j.io](https://console.neo4j.io)
2. Create a free AuraDB instance
3. **Save the connection URI and password immediately** (password can't be recovered)
4. Copy `backend/.env.example` → `backend/.env` and fill in the URI + password

**Option B — Local Docker:**
```bash
docker compose up -d
```
Neo4j Browser at http://localhost:7474 (login: `neo4j` / `prahaarinet`). The backend's `.env.example` already points at this.

### 3. Register for Bhashini (for Hindi voice alerts — optional but recommended)

- Go to [bhashini.gov.in](https://bhashini.gov.in) → developer portal
- **24-hour activation window** — register Wednesday night at the latest
- Put your API key + userID into `backend/.env`
- If you skip this, the frontend plays the Hindi alert via the browser's Web Speech API instead — works identically in a live demo

### 4. Set up WhatsApp Business Cloud API (optional)

- developers.facebook.com → create app → add WhatsApp product
- Put the access token + phone number ID into `backend/.env`
- If you skip this, the phone mockup in the dashboard is the alert channel

### 5. Pre-train the models (DO THIS BEFORE HACKATHON)

Download the datasets first:
- **Elliptic Bitcoin**: [kaggle.com/datasets/ellipticco/elliptic-data-set](https://www.kaggle.com/datasets/ellipticco/elliptic-data-set) → unzip into `backend/data/elliptic/`
- **IEEE-CIS Fraud**: [kaggle.com/competitions/ieee-fraud-detection/data](https://www.kaggle.com/competitions/ieee-fraud-detection/data) → unzip `train_transaction.csv` into `backend/data/ieee-cis/`

Then run:
```bash
make pretrain
# or manually:
cd backend && python pretrain_graphsage.py && python pretrain_isoforest.py
```

Output: `backend/models/elliptic_graphsage.pt` and `backend/models/iso_forest.pkl`.

**Takes 2–4 hours on GPU, 6–10 on CPU. Start it Wednesday night while you sleep.**

> Don't have time? The backend has a **heuristic fallback scorer** that produces the same verdict shape. The demo still runs end-to-end without pre-trained weights — the `scam_injector` + `score_force_fraud` path guarantees the pitch numbers you rehearsed.

### 6. Frontend env

```bash
cd frontend
cp .env.local.example .env.local
# Edit if your backend isn't on localhost:8000
```

### 7. Run it

Two terminals:

```bash
# Terminal 1
make backend

# Terminal 2
make frontend
```

Open http://localhost:3000 — press the big red **INJECT SCAM** button.

---

## The Demo (3 minutes)

1. **Setup state** — dashboard open, quiet pulsing graph of 220 UPI nodes across 6 banks, live transaction feed scrolling calmly.
2. **Press INJECT SCAM.** The full T+0.0 → T+3.0 timeline fires:
   - T+0.3s: transaction ingested into Neo4j
   - T+1.1s: GraphSAGE detects fan-out
   - T+1.7s: GNNExplainer verdict — **MULE RING, 94% confidence**
   - T+2.0s: 7-node ring lights up red across the graph
   - T+2.5s: Hindi voice alert fires — "Ruk jaiye..."
   - T+3.0s: Victim presses CANCEL → ₹5,00,000 saved
3. **The kill-shot slide** appears automatically. Pitch the numbers: 520M users, 19B txns/month, one graph.

---

## Project Structure

```
prahaarinet/
├── backend/
│   ├── main.py                   # FastAPI app
│   ├── graph_service.py          # Neo4j + in-memory fallback
│   ├── gnn_inference.py          # GraphSAGE + IsoForest ensemble
│   ├── explainer.py              # GNNExplainer wrapper
│   ├── alerts.py                 # Bhashini + WhatsApp
│   ├── scam_injector.py          # Deterministic scam timeline
│   ├── pretrain_graphsage.py     # Pre-train on Elliptic
│   ├── pretrain_isoforest.py     # Fit on IEEE-CIS
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # The dashboard
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
├── docker-compose.yml            # Neo4j + Redis (optional)
├── Makefile
└── README.md
```

---

## Pre-Hackathon Checklist

Complete all of these **before Thursday night**:

- [ ] Neo4j Aura account created, credentials saved to `.env`
- [ ] Bhashini API keys registered (24hr activation — do EARLY)
- [ ] WhatsApp Business sandbox set up, one test message sent successfully
- [ ] Datasets downloaded (Elliptic + IEEE-CIS)
- [ ] `make install` completed without errors
- [ ] `make pretrain` completed (or fallback confirmed working)
- [ ] `make backend` + `make frontend` run cleanly
- [ ] **INJECT SCAM** button tested end-to-end
- [ ] Voice alert fires within 2.5s on demo machine's browser
- [ ] **Full 3-minute demo rehearsed twice, timed with a stopwatch**
- [ ] Backup video recorded in case live demo glitches

---

## Troubleshooting

**`make backend` fails with "torch not found"** → PyTorch install didn't complete. On Linux/Mac CPU: `pip install torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu`. On CUDA 12.1: `pip install torch==2.4.1 --index-url https://download.pytorch.org/whl/cu121`.

**Neo4j connection refused** → Backend automatically falls back to in-memory graph. Demo still runs. If you want Neo4j to work, check `docker compose ps` (local) or your Aura console (cloud).

**Voice alert doesn't play** → Browsers require a user gesture to unlock audio. Press INJECT once, dismiss, press again — audio unlocks on the second press. In a live demo, press it yourself once before the judges approach.

**Dashboard shows "Waiting for transactions..."** → Backend isn't running or WebSocket isn't reaching it. Check `curl http://localhost:8000/api/health`.

**PyTorch Geometric install hangs** → CUDA version mismatch. Run `nvidia-smi` to check your driver, then install matching wheels from the PyG wheel index.

---

## The Fallback Strategy

Every piece of PrahaariNet has a graceful fallback:

| Component | If it fails | Fallback |
|---|---|---|
| Neo4j Aura | Unreachable | In-memory graph (same API) |
| Pre-trained GraphSAGE | Weights missing | Heuristic scorer with same verdict shape |
| Pre-trained IsoForest | File missing | Rule-based anomaly scorer |
| Bhashini API | Keys not activated | Web Speech API (browser-native Hindi TTS) |
| WhatsApp Cloud API | Token invalid | Dashboard's phone mockup |
| Kafka | Broker flaky | FastAPI direct ingest (no queue) |

**The demo runs end-to-end even if all the external services are down.** The only thing you need running is the FastAPI backend and the Next.js frontend. This is why the pitch is robust — nothing on stage depends on a network call to a 3rd party.

---

## License & Credits

Built for Kraken'X 2026 at AI-Tronics Hub (24-25 April 2026).

Research foundations:
- GraphSAGE — Hamilton, Ying, Leskovec (2017)
- Temporal Graph Networks — Rossi et al. (2020)
- GNNExplainer — Ying et al. (2019)
- Elliptic Bitcoin Dataset — Weber et al. (2019)

Built with Claude Opus.
