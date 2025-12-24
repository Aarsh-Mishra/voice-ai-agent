# backend/services.py
import os
import uuid
import time
from deepgram import DeepgramClient
from groq import Groq
from dotenv import load_dotenv
from database import db
from bson import ObjectId

load_dotenv()

# --- INITIALIZATION ---
deepgram_key = os.getenv("DEEPGRAM_API_KEY")
if not deepgram_key:
    print("❌ ERROR: DEEPGRAM_API_KEY is missing in .env")

deepgram = DeepgramClient(api_key=deepgram_key)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

async def process_voice_pipeline(audio_file: bytes, agent_id: str):
    """
    1. Fetch Agent Config (System Prompt, Providers)
    2. STT: Convert Audio to Text
    3. LLM: Generate Response (Using Agent's Prompt)
    4. TTS: Convert Text to Audio
    """
    unique_id = uuid.uuid4().hex
    temp_filename = f"temp_output_{unique_id}.mp3"

    # --- 0. FETCH AGENT CONFIG ---
    try:
        if not agent_id or not ObjectId.is_valid(agent_id):
            raise Exception("Invalid Agent ID provided")
            
        agent = await db.agents.find_one({"_id": ObjectId(agent_id)})
        if not agent:
            raise Exception("Agent not found")
            
        # Get the system prompt from the DB (or use default)
        system_prompt = agent.get("system_prompt", "You are a helpful assistant.")
        voice_model = agent.get("voice_model", "aura-asteria-en")
        
        print(f"🔹 Using Agent: {agent.get('name')} | Voice: {voice_model}")

    except Exception as e:
        print(f"❌ Database Error: {e}")
        return {"error": str(e)}
    
    # --- 1. SPEECH TO TEXT (STT) ---
    try:
        source = {"buffer": audio_file}
        options = {
            "model": "nova-2",
            "smart_format": True,
            "mimetype": "audio/mp3" 
        }
        
        response = deepgram.listen.prerecorded.v("1").transcribe_file(source, options)
        user_text = response["results"]["channels"][0]["alternatives"][0]["transcript"]
        
        if not user_text:
            return {"error": "No speech detected"}
            
        print(f"🎤 User said: {user_text}")

    except Exception as e:
        print(f"❌ STT Error: {e}")
        return {"error": f"Failed to transcribe audio: {str(e)}"}

    # --- 2. LLM PROCESSING (Groq) ---
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt  # <--- DYNAMIC PROMPT USED HERE
                },
                {
                    "role": "user",
                    "content": user_text,
                }
            ],
            model="llama-3.1-8b-instant",
        )
        ai_text = chat_completion.choices[0].message.content
        print(f"🤖 AI Response: {ai_text}")

    except Exception as e:
        print(f"❌ LLM Error: {e}")
        return {"error": f"Failed to generate AI response: {str(e)}"}

    # --- 3. TEXT TO SPEECH (TTS) ---
    try:
        options = { "model": voice_model }
        
        deepgram.speak.v("1").save(temp_filename, {"text": ai_text}, options)
        
        with open(temp_filename, "rb") as f:
            audio_data = f.read()
            
        return {
            "user_text": user_text,
            "ai_text": ai_text,
            "audio_data": audio_data
        }

    except Exception as e:
        print(f"❌ TTS Error: {e}")
        return {"error": f"Failed to synthesize speech: {str(e)}"}
        
    finally:
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except:
                pass