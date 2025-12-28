from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from urllib.parse import quote
import json

# Import your existing MongoDB connection
from database import test_db_connection
from agents import router as agents_router
from auth import router as auth_router
from services import process_voice_pipeline

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routes
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(agents_router, prefix="/agents", tags=["Agents"])

@app.on_event("startup")
async def startup_db_client():
    await test_db_connection()

@app.get("/")
async def root():
    return {"message": "Voice AI Backend is running!"}

# --- VOICE ENDPOINT (UPDATED) ---
@app.post("/chat/audio")
async def chat_audio(
    file: UploadFile = File(...),
    agent_id: str = Form(...),
    chat_history: str = Form(None) # <--- IMPORTANT: Accept this field
):
    try:
        audio_bytes = await file.read()
        
        # Pass history to service
        result = await process_voice_pipeline(audio_bytes, agent_id, chat_history)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        return Response(
            content=result["audio_data"],
            media_type="audio/mpeg",
            headers={
                "X-User-Text": quote(result["user_text"]),
                "X-AI-Text": quote(result["ai_text"])
            }
        )
        
    except Exception as e:
        print(f"Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))