import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    meta,
    tools,
    scenarios,
    assumptions,
    simulation,
    agent,
    noise,
    summary,
)

app = FastAPI(
    title="ROI Cyber-Validator API",
    description="Cyber Risk Prediction Platform Backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(meta.router)
app.include_router(tools.router)
app.include_router(scenarios.router)
app.include_router(assumptions.router)
app.include_router(simulation.router)
app.include_router(agent.router)
app.include_router(noise.router)
app.include_router(summary.router)

@app.get("/")
def root():
    return {
        "message": "Welcome to ROI Cyber-Validator API",
        "docs": "/docs",
        "health": "/api/health",
    }
