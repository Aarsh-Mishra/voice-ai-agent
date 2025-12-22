from pydantic import BaseModel, Field
from typing import Optional

class AgentCreate(BaseModel):
    name: str = Field(..., example="Funny Bot")
    system_prompt: str = Field(..., example="You are a comedian. Answer everything with a joke.")
    voice_model: str = Field(default="aura-asteria-en", example="aura-asteria-en")

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    voice_model: Optional[str] = None

class AgentResponse(AgentCreate):
    id: str
    user_id: str