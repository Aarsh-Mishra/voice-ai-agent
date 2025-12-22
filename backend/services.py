# backend/services.py
import os
import uuid
import time
from deepgram import DeepgramClient
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# --- INITIALIZATION ---
deepgram_key = os.getenv("DEEPGRAM_API_KEY")
if not deepgram_key:
    print("❌ ERROR: DEEPGRAM_API_KEY is missing in .env")

deepgram = DeepgramClient(api_key=deepgram_key)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

async def process_voice_pipeline(audio_file: bytes):
    """
    1. STT: Convert Audio to Text (Deepgram)
    2. LLM: Generate Response (Groq)
    3. TTS: Convert Text to Audio (Deepgram)
    """
    unique_id = uuid.uuid4().hex
    temp_filename = f"temp_output_{unique_id}.mp3"
    
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
                    "content": "You are a helpful voice assistant. Keep answers very concise (max 1-2 sentences) and conversational."
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

    # --- 3. TEXT TO SPEECH (TTS) - WITH RETRY LOGIC ---
    try:
        options = { "model": "aura-asteria-en" }
        
        # Retry up to 3 times if SSL/Network fails
        max_retries = 3
        for attempt in range(max_retries):
            try:
                deepgram.speak.v("1").save(temp_filename, {"text": ai_text}, options)
                break # Success! Exit loop
            except Exception as e:
                print(f"⚠️ TTS Attempt {attempt+1} failed: {e}")
                if attempt == max_retries - 1:
                    raise e # Give up after 3 tries
                time.sleep(1) # Wait 1 second before retrying
        
        # Read the file back
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
        # Cleanup
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except:
                pass