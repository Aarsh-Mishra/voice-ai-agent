from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import test_db_connection
from agents import router as agents_router
from auth import router as auth_router
from services import process_voice_pipeline # Import the new service

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

# --- VOICE ENDPOINT ---
@app.post("/chat/audio")
async def chat_audio(file: UploadFile = File(...)):
    """
    Receives an audio file (MP3/WAV), processes it (STT -> LLM -> TTS),
    and returns the audio binary + headers with the transcript.
    """
    try:
        # Read file bytes
        audio_bytes = await file.read()
        
        # Run Pipeline
        result = await process_voice_pipeline(audio_bytes)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        # Return Audio File with transcripts in headers
        return Response(
            content=result["audio_data"],
            media_type="audio/mpeg",
            headers={
                "X-User-Text": result["user_text"],
                "X-AI-Text": result["ai_text"]
            }
        )
        
    except Exception as e:
        print(f"Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))