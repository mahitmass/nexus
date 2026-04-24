"""
PrahaariNet — Scam injector.

Builds the deterministic fraud choreography from build doc §1.3:
  1. Victim sends ₹5,00,000 to 'cbi.safe@upi'
  2. Funds fan out to 7 mules in under 60s
  3. Each mule forwards 90%+ within 11s
  4. Money cycles through 3-hop clusters
"""
import random

BANKS = ["HDFC", "SBI", "ICICI", "AXIS", "KOTAK", "PNB"]
MULE_NAMES = ["rohan", "priya", "arjun", "kavya", "vikram", "anita", "rahul"]
LAYER2_NAMES = ["deepa", "suresh", "meera", "ajay", "neha"]


def build_scam_timeline(seed: int = 42) -> dict:
    """Returns a deterministic scam timeline that matches the doc's exact numbers."""
    rng = random.Random(seed)

    victim = "grandma.kanta@hdfc"
    primary_receiver = "cbi.safe@upi"

    # 7 mules across 4-6 different banks (per §1.2)
    mules = []
    banks_used = rng.sample(BANKS, 5)
    for i, name in enumerate(MULE_NAMES):
        bank = banks_used[i % len(banks_used)]
        mules.append(f"{name}.sharma@{bank.lower()}")

    # Layer 2 — each mule forwards to one of 5 layer-2 accounts
    layer2_nodes = [f"{name}{i}@{rng.choice(BANKS).lower()}" for i, name in enumerate(LAYER2_NAMES)]
    layer2_edges = [(mules[i], layer2_nodes[i % len(layer2_nodes)]) for i in range(len(mules))]

    return {
        "victim": victim,
        "primary_receiver": primary_receiver,
        "mules": mules,
        "layer2_nodes": layer2_nodes,
        "layer2_edges": layer2_edges,
        "total_amount": 500000,
        "fan_out_window_s": 47,
        "forwarding_ratio": 0.93,
        "forwarding_window_s": 11,
    }
