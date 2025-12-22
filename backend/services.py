# backend/services.py
import os
from deepgram import DeepgramClient
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# --- INITIALIZATION ---
deepgram_key = os.getenv("DEEPGRAM_API_KEY")
if not deepgram_key:
    print("❌ ERROR: DEEPGRAM_API_KEY is missing in .env")

# FIX: Removed the failing DeepgramClientOptions.
# We will rely on the concise system prompt to ensure audio generates quickly.
deepgram = DeepgramClient(api_key=deepgram_key)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

async def process_voice_pipeline(audio_file: bytes):
    """
    1. STT: Convert Audio to Text (Deepgram)
    2. LLM: Generate Response (Groq)
    3. TTS: Convert Text to Audio (Deepgram)
    """
    
    # --- 1. SPEECH TO TEXT (STT) ---
    try:
        # Prepare Source
        payload = {
            "buffer": audio_file,
        }
        
        # Options
        options = {
            "model": "nova-2",
            "smart_format": True,
            "mimetype": "audio/mp3" 
        }
        
        # STT Call
        response = deepgram.listen.prerecorded.v("1").transcribe_file(payload, options)
        
        # Parse Response
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
                    # KEY FIX: Instructions to be concise prevent TTS timeouts
                    "content": "You are a helpful voice assistant. Keep answers very concise (max 2 sentences) and conversational."
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
        options = {
            "model": "aura-asteria-en"
        }
        
        filename = "temp_output.mp3"
        
        # TTS Call
        deepgram.speak.v("1").save(filename, {"text": ai_text}, options)
        
        # Read the file back into bytes
        with open(filename, "rb") as f:
            audio_data = f.read()
        
        # Cleanup temp file
        if os.path.exists(filename):
            os.remove(filename)
            
        return {
            "user_text": user_text,
            "ai_text": ai_text,
            "audio_data": audio_data
        }

    except Exception as e:
        print(f"❌ TTS Error: {e}")
        return {"error": f"Failed to synthesize speech: {str(e)}"}