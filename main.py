"""
Project Nexus — AI Processing Service
FastAPI skeleton — agnostic. Domain logic injected via config.
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
import logging

from app.core.config import settings
from app.routers import health, inference, rag, embeddings, data

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("AI service starting up...")
    # Initialize vector store connection
    # Initialize LangChain chains
    # Initialize model clients
    yield
    # Shutdown
    logger.info("AI service shutting down...")


# Sentry
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.2,
    )

app = FastAPI(
    title="Project Nexus — AI Service",
    description="Agnostic AI processing microservice. Swap domain config to change theme.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
Instrumentator().instrument(app).expose(app)

# Routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(inference.router, prefix="/api/v1/inference", tags=["inference"])
app.include_router(rag.router, prefix="/api/v1/rag", tags=["rag"])
app.include_router(embeddings.router, prefix="/api/v1/embeddings", tags=["embeddings"])
app.include_router(data.router, prefix="/api/v1/data", tags=["data"])


@app.get("/")
async def root():
    return {
        "service": "nexus-ai-service",
        "version": "0.1.0",
        "status": "running",
        "theme": settings.DOMAIN_THEME,  # "agriculture" | "healthcare" | "fintech"
    }
