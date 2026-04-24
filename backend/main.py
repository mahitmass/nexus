"""
PrahaariNet — FastAPI backend
Real-time UPI mule ring detection via Temporal GNN.

Endpoints:
  POST /api/inject        — trigger the demo scam injection
  POST /api/score         — score a single transaction
  POST /api/action/{id}   — victim cancel/proceed on a held transaction
  GET  /api/stats         — live stats (scanned, flagged, saved)
  GET  /api/graph         — return the current graph snapshot for viz
  WS   /ws/feed           — live transaction stream + verdicts
"""
import asyncio
import json
import logging
import os
import random
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from graph_service import GraphService
from gnn_inference import FraudScorer
from explainer import ExplainerService
from alerts import AlertService
from scam_injector import build_scam_timeline

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("prahaarinet")

# ---------- Lifecycle -----------------------------------------------------------
graph: Optional[GraphService] = None
scorer: Optional[FraudScorer] = None
explainer: Optional[ExplainerService] = None
alerts: Optional[AlertService] = None

# In-memory state
STATS = {"scanned": 0, "flagged": 0, "saved_inr": 0}
HOLDS = {}           # txn_id -> {"status": "held"|"cancelled"|"proceed", "amount": int, ...}
FEED_SUBSCRIBERS: set[WebSocket] = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global graph, scorer, explainer, alerts
    log.info("Booting PrahaariNet backend...")
    graph = GraphService(
        uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        user=os.getenv("NEO4J_USER", "neo4j"),
        password=os.getenv("NEO4J_PASSWORD", "prahaarinet"),
    )
    await graph.connect()
    scorer = FraudScorer(model_path=os.getenv("MODEL_PATH", "models/elliptic_graphsage.pt"),
                         iso_path=os.getenv("ISO_PATH", "models/iso_forest.pkl"))
    scorer.load()
    explainer = ExplainerService()
    alerts = AlertService(
        bhashini_key=os.getenv("BHASHINI_KEY"),
        bhashini_udyat=os.getenv("BHASHINI_UDYAT"),
        whatsapp_token=os.getenv("WHATSAPP_TOKEN"),
        whatsapp_phone_id=os.getenv("WHATSAPP_PHONE_ID"),
    )
    # Start background noise generator (simulates live UPI traffic)
    asyncio.create_task(background_noise())
    log.info("PrahaariNet backend ready.")
    yield
    log.info("Shutting down...")
    await graph.close()


app = FastAPI(title="PrahaariNet", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------- Schemas -------------------------------------------------------------
class Transaction(BaseModel):
    sender_vpa: str
    receiver_vpa: str
    amount: float
    timestamp: Optional[float] = None


class VictimAction(BaseModel):
    action: str  # "cancel" | "proceed"


# ---------- Broadcast helpers ---------------------------------------------------
async def broadcast(event: dict):
    """Push an event to all connected dashboard clients."""
    event["ts"] = datetime.utcnow().isoformat()
    dead = []
    for ws in FEED_SUBSCRIBERS:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        FEED_SUBSCRIBERS.discard(ws)


async def background_noise():
    """Generate ambient UPI transactions so the graph feels alive."""
    await asyncio.sleep(2)
    while True:
        try:
            sender, receiver = await graph.random_node_pair()
            amount = random.randint(100, 50000)
            STATS["scanned"] += 1
            await broadcast({
                "type": "txn",
                "from": sender,
                "to": receiver,
                "amount": amount,
                "flagged": False,
            })
        except Exception as e:
            log.debug(f"noise skip: {e}")
        await asyncio.sleep(random.uniform(0.4, 0.9))


# ---------- Endpoints -----------------------------------------------------------
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "neo4j": await graph.is_connected(),
        "model_loaded": scorer.ready,
        "version": "1.0.0",
    }


@app.get("/api/stats")
async def get_stats():
    return STATS


@app.get("/api/graph")
async def get_graph():
    """Return a snapshot of the current graph for initial dashboard render."""
    return await graph.snapshot(limit=220)


@app.post("/api/score")
async def score(txn: Transaction):
    """Score a single transaction. Returns verdict + explainer output."""
    t0 = time.perf_counter()
    STATS["scanned"] += 1

    # 1. Write edge to graph
    await graph.insert_edge(txn.sender_vpa, txn.receiver_vpa, txn.amount)

    # 2. Extract 2-hop subgraph around receiver
    subgraph = await graph.k_hop_subgraph(txn.receiver_vpa, k=2)

    # 3. GNN + Isolation Forest ensemble
    verdict = scorer.score(subgraph, txn.dict())

    # 4. Explainer
    if verdict["is_fraud"]:
        verdict["explainer"] = explainer.explain(subgraph, verdict)
        STATS["flagged"] += 1

    verdict["inference_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return verdict


@app.post("/api/inject")
async def inject():
    """THE demo button. Fires the full Section 1.3 scam choreography."""
    scam_id = f"scam-{uuid.uuid4().hex[:8]}"
    asyncio.create_task(run_scam_demo(scam_id))
    return {"scam_id": scam_id, "status": "injected"}


async def run_scam_demo(scam_id: str):
    """Replays the exact T+0.0 → T+3.0 timeline from the build doc §4.2."""
    timeline = build_scam_timeline()

    # T+0.0s — Victim sends ₹5,00,000 to cbi.safe@upi
    await broadcast({"type": "phase", "phase": "injecting", "scam_id": scam_id})
    await broadcast({
        "type": "txn", "scam": True,
        "from": timeline["victim"], "to": timeline["primary_receiver"],
        "amount": 500000,
    })
    await graph.insert_edge(timeline["victim"], timeline["primary_receiver"], 500000)

    # T+0.3s — Kafka ingests, edge in Neo4j
    await asyncio.sleep(0.3)
    await broadcast({"type": "system", "text": "⟶ txn-stream ingested · edge written to Neo4j"})

    # T+0.6s — GraphSAGE 2-hop embedding
    await asyncio.sleep(0.3)
    subgraph = await graph.k_hop_subgraph(timeline["primary_receiver"], k=2)
    await broadcast({"type": "system", "text": f"⟶ GraphSAGE · 2-hop · {len(subgraph.get('nodes', []))} nodes sampled"})

    # T+1.1s — TGN temporal layer detects fan-out
    await asyncio.sleep(0.5)
    await broadcast({"type": "phase", "phase": "detecting"})
    await broadcast({"type": "system", "text": "⟶ TGN · fan-out detected · 7 recipients in 47s"})
    for i, mule in enumerate(timeline["mules"]):
        await graph.insert_edge(timeline["primary_receiver"], mule, 500000 / 7)
        await broadcast({
            "type": "fanout", "from": timeline["primary_receiver"], "to": mule,
            "step": i, "of": len(timeline["mules"])
        })
        await asyncio.sleep(0.03)

    # T+1.4s — Isolation Forest confirms
    await asyncio.sleep(0.2)
    await broadcast({"type": "system", "text": "⟶ IsoForest · forwarding 0.93 · fan-in velocity 14.2×"})
    for i, (src, dst) in enumerate(timeline["layer2_edges"]):
        await graph.insert_edge(src, dst, 500000 / 7 * 0.93)
        await broadcast({"type": "fanout", "from": src, "to": dst, "step": i, "of": len(timeline["layer2_edges"])})
        await asyncio.sleep(0.03)

    # T+1.7s — GNNExplainer verdict
    await asyncio.sleep(0.3)
    verdict = scorer.score_force_fraud(subgraph)
    verdict["explainer"] = explainer.explain(subgraph, verdict, force_ring_ref="MC-2024-0041")
    await broadcast({
        "type": "verdict", "verdict": verdict,
        "flagged_nodes": [timeline["primary_receiver"], *timeline["mules"], *[d for _, d in timeline["layer2_edges"]]]
    })
    STATS["flagged"] += 1

    # T+2.0s — Transaction held
    await asyncio.sleep(0.3)
    txn_id = f"txn-{uuid.uuid4().hex[:8]}"
    HOLDS[txn_id] = {"status": "held", "amount": 500000, "created_at": time.time()}
    await broadcast({"type": "phase", "phase": "holding", "txn_id": txn_id, "hold_seconds": 30})

    # T+2.5s — Voice alert fired (vernacular)
    await asyncio.sleep(0.5)
    await alerts.fire_voice_alert(phone="+91XXXXXXXXXX", lang="hi")
    await alerts.fire_whatsapp(phone="+91XXXXXXXXXX", text="PrahaariNet: Ruk jaiye. Ye transaction ek dhokha ho sakta hai.")
    await broadcast({"type": "phase", "phase": "alerted", "txn_id": txn_id})

    # Auto-release after 30s if no victim action
    await asyncio.sleep(30)
    if HOLDS.get(txn_id, {}).get("status") == "held":
        HOLDS[txn_id]["status"] = "auto-released"
        await broadcast({"type": "phase", "phase": "blocked", "txn_id": txn_id})


@app.post("/api/action/{txn_id}")
async def victim_action(txn_id: str, action: VictimAction):
    """Victim presses CANCEL or PROCEED on a held transaction."""
    if txn_id not in HOLDS:
        raise HTTPException(404, "Transaction not found")
    hold = HOLDS[txn_id]
    if hold["status"] != "held":
        return {"status": hold["status"], "message": "already resolved"}

    if action.action == "cancel":
        hold["status"] = "cancelled"
        STATS["saved_inr"] += hold["amount"]
        await broadcast({"type": "phase", "phase": "saved", "txn_id": txn_id, "amount": hold["amount"]})
        return {"status": "cancelled", "message": f"₹{hold['amount']:,} retained"}

    elif action.action == "proceed":
        hold["status"] = "proceeded"
        await broadcast({"type": "phase", "phase": "blocked", "txn_id": txn_id})
        return {"status": "proceeded", "message": "flagged for I4C review"}

    raise HTTPException(400, "invalid action")


@app.websocket("/ws/feed")
async def feed_socket(ws: WebSocket):
    await ws.accept()
    FEED_SUBSCRIBERS.add(ws)
    log.info(f"Dashboard connected ({len(FEED_SUBSCRIBERS)} total)")
    try:
        # Send initial state
        await ws.send_json({"type": "hello", "stats": STATS})
        while True:
            # Keep connection alive; the ws is server-push only
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        FEED_SUBSCRIBERS.discard(ws)
        log.info(f"Dashboard disconnected ({len(FEED_SUBSCRIBERS)} remain)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
