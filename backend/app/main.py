from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.videos import router as videos_router
from app.core.logging import setup_logging
import logging
from app.api.clips import router as clips_router
from app.api.social import router as social_router
from app.api.publishing import router as publishing_router

setup_logging()

app = FastAPI(
    title="Clip AI API",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(videos_router)
app.include_router(clips_router)
app.include_router(social_router)
app.include_router(publishing_router)

@app.get("/")
async def root():
    return {
        "message": "Clip AI API is running"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }

