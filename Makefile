# PrahaariNet — Developer shortcuts
# Usage: make <target>

.PHONY: help install pretrain infra backend frontend dev clean

help:
	@echo "PrahaariNet targets:"
	@echo "  make install    — install backend + frontend deps"
	@echo "  make pretrain   — train GraphSAGE + IsoForest (do this BEFORE hackathon)"
	@echo "  make infra      — start local Neo4j + Redis via Docker"
	@echo "  make backend    — run FastAPI backend on :8000"
	@echo "  make frontend   — run Next.js frontend on :3000"
	@echo "  make dev        — run infra + backend + frontend together"
	@echo "  make clean      — nuke caches and installed deps"

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

pretrain:
	cd backend && python pretrain_graphsage.py
	cd backend && python pretrain_isoforest.py

infra:
	docker compose up -d
	@echo "Neo4j Browser: http://localhost:7474  (login: neo4j / prahaarinet)"
	@echo "Redis: localhost:6379"

backend:
	cd backend && python main.py

frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting infra..."
	@docker compose up -d
	@sleep 5
	@echo "Launch backend in one terminal: make backend"
	@echo "Launch frontend in another:     make frontend"

clean:
	rm -rf backend/__pycache__ backend/*.pyc
	rm -rf frontend/.next frontend/node_modules
	docker compose down -v
