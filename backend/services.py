# backend/services.py
import os
import httpx
from deepgram import DeepgramClient, PrerecordedOptions, SpeakOptions
from groq import Groq

# Initialize Clients
# Ensure DEEPGRAM_API_KEY and GROQ_API_KEY are in your .env file
deepgram = DeepgramClient(os.getenv("DEEPGRAM_API_KEY"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

async def process_voice_pipeline(audio_file: bytes):
    """
    1. STT: Convert Audio to Text (Deepgram)
    2. LLM: Generate Response (Groq)
    3. TTS: Convert Text to Audio (Deepgram)
    """
    
    # --- 1. SPEECH TO TEXT (STT) ---
    try:
        source = {"buffer": audio_file, "mimetype": "audio/mp3"}
        options = PrerecordedOptions(
            model="nova-2",
            smart_format=True
        )
        stt_response = deepgram.listen.prerecorded.v("1").transcribe_file(source, options)
        user_text = stt_response["results"]["channels"][0]["alternatives"][0]["transcript"]
        
        if not user_text:
            return {"error": "No speech detected"}
            
        print(f"🎤 User said: {user_text}")

    except Exception as e:
        print(f"❌ STT Error: {e}")
        return {"error": "Failed to transcribe audio"}

    # --- 2. LLM PROCESSING (Groq) ---
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful voice assistant. Keep answers concise and conversational."
                },
                {
                    "role": "user",
                    "content": user_text,
                }
            ],
            model="llama3-8b-8192",
        )
        ai_text = chat_completion.choices[0].message.content
        print(f"🤖 AI Response: {ai_text}")

    except Exception as e:
        print(f"❌ LLM Error: {e}")
        return {"error": "Failed to generate AI response"}

    # --- 3. TEXT TO SPEECH (TTS) ---
    try:
        options = SpeakOptions(
            model="aura-asteria-en", # or aura-helios-en
        )
        
        # Deepgram TTS saves the file locally or returns bytes. 
        # For an API, we want bytes.
        filename = "temp_output.mp3"
        deepgram.speak.v("1").save(filename, {"text": ai_text}, options)
        
        # Read the file back into bytes to return it
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
        return {"error": "Failed to synthesize speech"}