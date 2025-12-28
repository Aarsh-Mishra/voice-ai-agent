from pydantic import BaseModel, Field, EmailStr
from typing import Optional

# --- AGENT MODELS ---
class AgentCreate(BaseModel):
    name: str = Field(..., example="Funny Bot")
    system_prompt: str = Field(..., example="You are a comedian. Answer everything with a joke.")
    voice_model: str = Field(default="aura-asteria-en", example="aura-asteria-en")
    
    # Provider Selection
    stt_provider: str = Field(default="deepgram", example="deepgram") 
    llm_provider: str = Field(default="groq", example="groq")         
    tts_provider: str = Field(default="deepgram", example="deepgram") 
    
    # NEW: Gender for UI logic (optional, but good to have in DB)
    gender: str = Field(default="female", example="female")

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    voice_model: Optional[str] = None
    stt_provider: Optional[str] = None
    llm_provider: Optional[str] = None
    tts_provider: Optional[str] = None
    gender: Optional[str] = None

class AgentResponse(AgentCreate):
    id: str
    user_id: str

# --- USER MODELS (Moved here to fix ImportError) ---
class UserSignup(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None