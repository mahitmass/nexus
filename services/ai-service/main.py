from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import random

app = FastAPI(title="Nexus Universal AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DataRequest(BaseModel):
    query: str
    theme: str = "general"

@app.post("/api/analyze")
def analyze_data(req: DataRequest):
    risk_score = random.randint(15, 85)
    insights = {
        "agriculture": f"Analysis of '{req.query}': Potential nutrient deficiency detected.",
        "healthcare": f"Analysis of '{req.query}': Elevated triage priority. Monitor vitals.",
        "neuro": f"Analysis of '{req.query}': Indicators suggest sensory strain. Use coping protocol.",
        "general": f"System processed: {req.query}. No critical anomalies."
    }
    return {
        "status": "success",
        "risk_score": risk_score,
        "ai_insight": insights.get(req.theme.lower(), insights["general"]),
        "action_required": risk_score > 50
    }