# backend/services.py
import os
import uuid
import time
import requests 
import edge_tts  # <--- NEW: Free Microsoft Neural Voice
from deepgram import DeepgramClient
from groq import Groq
from openai import OpenAI
import google.generativeai as genai
from dotenv import load_dotenv
from database import db
from bson import ObjectId

load_dotenv()

# --- INITIALIZATION ---
# 1. Deepgram (Still used for STT - Listening)
deepgram_key = os.getenv("DEEPGRAM_API_KEY")
deepgram = DeepgramClient(api_key=deepgram_key) if deepgram_key else None

# 2. Groq
groq_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=groq_key) if groq_key else None

# 3. OpenAI
openai_key = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=openai_key) if openai_key else None

# 4. Google Gemini
google_key = os.getenv("GOOGLE_API_KEY")
if google_key:
    genai.configure(api_key=google_key)

# 5. ElevenLabs
elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")

async def process_voice_pipeline(audio_file: bytes, agent_id: str):
    unique_id = uuid.uuid4().hex
    temp_filename = f"temp_output_{unique_id}.mp3"

    try:
        # --- 0. FETCH AGENT CONFIG ---
        if not agent_id or not ObjectId.is_valid(agent_id):
            raise Exception("Invalid Agent ID")
            
        agent = await db.agents.find_one({"_id": ObjectId(agent_id)})
        if not agent:
            raise Exception("Agent not found")
            
        system_prompt = agent.get("system_prompt", "You are a helpful assistant.")
        
        # Determine Providers
        stt_provider = agent.get("stt_provider", "deepgram")
        llm_provider = agent.get("llm_provider", "groq")
        tts_provider = agent.get("tts_provider", "edge") # Default to Edge now
        
        print(f"🔹 Agent: {agent.get('name')} | LLM: {llm_provider} | TTS: {tts_provider}")

        # --- 1. STT (Speech to Text) ---
        user_text = None
        for attempt in range(3):
            try:
                source = {"buffer": audio_file}
                options = {"model": "nova-2", "smart_format": True, "mimetype": "audio/mp3"}
                response = deepgram.listen.prerecorded.v("1").transcribe_file(source, options)
                user_text = response["results"]["channels"][0]["alternatives"][0]["transcript"]
                break
            except Exception as e:
                print(f"⚠️ STT Retry ({attempt+1}/3): {e}")
                time.sleep(1)
        
        if not user_text:
            return {"error": "Could not understand audio (STT Failed)."}
        
        print(f"🎤 User: {user_text}")

        # --- 2. LLM (Intelligence) ---
        ai_text = ""
        try:
            # OPTION A: Google Gemini
            if llm_provider == "gemini" and google_key:
                model = genai.GenerativeModel('gemini-1.5-flash')
                full_prompt = f"{system_prompt}\n\nUser says: {user_text}"
                response = model.generate_content(full_prompt)
                ai_text = response.text

            # OPTION B: OpenAI
            elif llm_provider == "openai" and openai_client:
                completion = openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_text}],
                    max_tokens=150
                )
                ai_text = completion.choices[0].message.content
            
            # OPTION C: Groq (Default)
            else:
                completion = groq_client.chat.completions.create(
                    messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_text}],
                    model="llama-3.1-8b-instant",
                )
                ai_text = completion.choices[0].message.content
        except Exception as e:
            return {"error": f"LLM Generation Failed: {e}"}
            
        print(f"🤖 AI: {ai_text}")

        # --- 3. TTS (Text to Speech) ---
        audio_data = None
        
        # --- EDGE TTS (Microsoft Free Neural) ---
        # This is the fastest, free option that fixes your latency
        if tts_provider == "edge" or tts_provider == "deepgram": # Fallback to Edge for now
            try:
                # Select Voice: "en-US-AriaNeural" (Female) or "en-US-GuyNeural" (Male)
                voice = "en-US-AriaNeural" 
                communicate = edge_tts.Communicate(ai_text, voice)
                await communicate.save(temp_filename)
                
                with open(temp_filename, "rb") as f:
                    audio_data = f.read()
            except Exception as e:
                 print(f"❌ Edge TTS Failed: {e}")
        
        # --- ELEVENLABS (If selected) ---
        elif tts_provider == "elevenlabs" and elevenlabs_key:
            try:
                voice_id = "21m00Tcm4TlvDq8ikWAM"
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                headers = {"xi-api-key": elevenlabs_key, "Content-Type": "application/json"}
                data = {
                    "text": ai_text,
                    "model_id": "eleven_monolingual_v1",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
                }
                resp = requests.post(url, json=data, headers=headers, timeout=10)
                if resp.status_code == 200:
                    audio_data = resp.content
            except Exception as e:
                print(f"❌ ElevenLabs Failed: {e}")

        if not audio_data:
            return {"error": "Failed to generate voice audio."}

        return {
            "user_text": user_text,
            "ai_text": ai_text,
            "audio_data": audio_data
        }

    except Exception as e:
        print(f"❌ Pipeline Error: {e}")
        return {"error": str(e)}
        
    finally:
        if os.path.exists(temp_filename):
            try: os.remove(temp_filename)
            except: pass