"""
PrahaariNet — Pre-train GraphSAGE on the Elliptic Bitcoin Dataset.

Usage (run ONCE, Wednesday night, while you sleep):
    cd backend
    python pretrain_graphsage.py

Output: models/elliptic_graphsage.pt

This is the pretrained structural-embedding model. On hackathon day you load
these weights and fine-tune for ~15 minutes on synthetic UPI data if you want.
"""
import logging
import sys
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv
from torch_geometric.datasets import EllipticBitcoinDataset

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pretrain")

MODEL_PATH = Path(__file__).parent / "models" / "elliptic_graphsage.pt"
DATA_ROOT = Path(__file__).parent / "data" / "elliptic"


class GraphSAGE(nn.Module):
    """Standard 2-layer GraphSAGE with skip connections."""
    def __init__(self, in_dim: int = 165, hidden: int = 64, out_dim: int = 2, dropout: float = 0.3):
        super().__init__()
        self.conv1 = SAGEConv(in_dim, hidden, aggr="mean")
        self.conv2 = SAGEConv(hidden, hidden, aggr="mean")
        self.classifier = nn.Linear(hidden, out_dim)
        self.dropout = dropout

    def forward(self, x, edge_index):
        h = F.relu(self.conv1(x, edge_index))
        h = F.dropout(h, p=self.dropout, training=self.training)
        h = F.relu(self.conv2(h, edge_index))
        return self.classifier(h)


def main():
    log.info("Loading Elliptic Bitcoin Dataset...")
    try:
        dataset = EllipticBitcoinDataset(root=str(DATA_ROOT))
    except Exception as e:
        log.error(f"Failed to load Elliptic dataset: {e}")
        log.error("Download manually from: https://www.kaggle.com/datasets/ellipticco/elliptic-data-set")
        log.error(f"Place files in {DATA_ROOT}")
        sys.exit(1)

    data = dataset[0]
    log.info(f"Graph: {data.num_nodes} nodes, {data.num_edges} edges")
    log.info(f"Features: {data.num_features}, Classes: {dataset.num_classes}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log.info(f"Using device: {device}")

    model = GraphSAGE(in_dim=data.num_features, hidden=64, out_dim=dataset.num_classes).to(device)
    data = data.to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=0.005, weight_decay=5e-4)
    criterion = nn.CrossEntropyLoss()

    best_acc = 0
    for epoch in range(1, 101):
        model.train()
        optimizer.zero_grad()
        out = model(data.x, data.edge_index)
        loss = criterion(out[data.train_mask], data.y[data.train_mask])
        loss.backward()
        optimizer.step()

        if epoch % 10 == 0:
            model.eval()
            with torch.no_grad():
                pred = out.argmax(dim=1)
                train_acc = (pred[data.train_mask] == data.y[data.train_mask]).float().mean().item()
                test_acc = (pred[data.test_mask] == data.y[data.test_mask]).float().mean().item()
                log.info(f"Epoch {epoch:3d} | loss {loss.item():.4f} | train {train_acc:.3f} | test {test_acc:.3f}")
                if test_acc > best_acc:
                    best_acc = test_acc
                    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
                    torch.save(model, MODEL_PATH)
                    log.info(f"  ↳ saved (best test acc {best_acc:.3f})")

    log.info(f"Done. Best test accuracy: {best_acc:.3f}")
    log.info(f"Model saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
