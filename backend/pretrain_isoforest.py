"""
PrahaariNet — Fit Isolation Forest on IEEE-CIS Fraud tabular features.

Usage:
    python pretrain_isoforest.py

Output: models/iso_forest.pkl
"""
import logging
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pretrain-iso")

MODEL_PATH = Path(__file__).parent / "models" / "iso_forest.pkl"
DATA_DIR = Path(__file__).parent / "data" / "ieee-cis"


def main():
    train_file = DATA_DIR / "train_transaction.csv"
    if not train_file.exists():
        log.error(f"Missing {train_file}")
        log.error("Download IEEE-CIS Fraud Detection from:")
        log.error("  https://www.kaggle.com/competitions/ieee-fraud-detection/data")
        log.error(f"Place train_transaction.csv in {DATA_DIR}")
        sys.exit(1)

    log.info(f"Loading {train_file}...")
    df = pd.read_csv(train_file, nrows=200_000)
    log.info(f"Loaded {len(df):,} rows")

    # Select the same 22 features our runtime scorer uses (approximate mapping)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    # Drop label + id
    for drop_col in ["isFraud", "TransactionID", "TransactionDT"]:
        if drop_col in numeric_cols:
            numeric_cols.remove(drop_col)
    # Pick top 22 by variance
    feature_cols = sorted(numeric_cols, key=lambda c: df[c].var(), reverse=True)[:22]
    log.info(f"Using {len(feature_cols)} features: {feature_cols[:5]}...")

    X = df[feature_cols].fillna(0).values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    log.info("Fitting Isolation Forest (this takes ~2 min)...")
    iso = IsolationForest(
        n_estimators=200,
        contamination=0.035,  # IEEE-CIS is ~3.5% fraud
        max_samples=5000,
        random_state=42,
        n_jobs=-1,
    )
    iso.fit(X_scaled)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": iso, "scaler": scaler, "features": feature_cols}, MODEL_PATH)
    log.info(f"Saved to {MODEL_PATH}")

    # Quick evaluation on the labelled subset
    if "isFraud" in df.columns:
        scores = -iso.decision_function(X_scaled)
        threshold = np.percentile(scores, 96.5)
        preds = (scores > threshold).astype(int)
        true = df["isFraud"].values
        tp = ((preds == 1) & (true == 1)).sum()
        fp = ((preds == 1) & (true == 0)).sum()
        fn = ((preds == 0) & (true == 1)).sum()
        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        log.info(f"Eval @ 96.5% threshold — precision {precision:.3f}, recall {recall:.3f}")


if __name__ == "__main__":
    main()
