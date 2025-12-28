# backend/services.py
import os
import uuid
import time
import json
import edge_tts 
from deepgram import DeepgramClient, SpeakOptions
from groq import Groq
import google.generativeai as genai # <--- 1. Import Google AI
from dotenv import load_dotenv
from database import db
from bson import ObjectId

load_dotenv()

# --- CLIENT INITIALIZATION ---
deepgram_key = os.getenv("DEEPGRAM_API_KEY")
deepgram = DeepgramClient(api_key=deepgram_key) if deepgram_key else None

groq_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=groq_key) if groq_key else None

# Initialize Gemini
gemini_key = os.getenv("GEMINI_API_KEY")
if gemini_key:
    genai.configure(api_key=gemini_key)

# backend/services.py (Update the process_voice_pipeline function)

async def process_voice_pipeline(audio_file: bytes, agent_id: str, chat_history: str = None):
    unique_id = uuid.uuid4().hex
    temp_filename = f"temp_output_{unique_id}.mp3"
    
    # --- 1. DEBUG: Check Audio Size ---
    file_size = len(audio_file)
    print(f"\n--- 🟢 START PIPELINE for Agent ID: '{agent_id}' ---")
    print(f"🎤 Received Audio Size: {file_size} bytes")

    if file_size < 1000: # Ignore audio files smaller than 1KB (likely silence/empty)
        print("⚠️ Audio too short/empty. Skipping.")
        return {"error": "Audio too short (Silence detected)."}

    try:
        # --- 2. VALIDATE AGENT ---
        if not agent_id or not ObjectId.is_valid(agent_id):
            return {"error": "Invalid Agent ID format"}
            
        agent = await db.agents.find_one({"_id": ObjectId(agent_id)})
        if not agent:
            return {"error": "Agent not found."}
            
        # Get Config
        base_system_prompt = agent.get("system_prompt", "You are a helpful assistant.")
        llm_provider = agent.get("llm_provider", "groq")
        tts_provider = agent.get("tts_provider", "deepgram")
        voice_model = agent.get("voice_model", "aura-asteria-en")

        # --- 3. BUILD CONTEXT ---
        # Priority 1: Use system_prompt from chat_history if provided (from frontend)
        # Priority 2: Use system_prompt from agent config
        # Priority 3: Use default
        
        system_prompt = f"{base_system_prompt}\n\n"
        
        if chat_history:
            try:
                history_data = json.loads(chat_history)
                print(f"📝 Parsed chat_history")  # DEBUG
                
                # Check if frontend sent context (Dict format)
                if isinstance(history_data, dict):
                    # New format: {system_prompt: "...", conversation_history: [...]}
                    frontend_system_prompt = history_data.get("system_prompt", "")
                    conversation_history = history_data.get("conversation_history", [])
                    
                    if frontend_system_prompt:
                        system_prompt = f"{frontend_system_prompt}\n\n"
                        print(f"  ✓ Using system_prompt from frontend")
                    
                    history_list = conversation_history
                    print(f"  ✓ Extracted conversation_history with {len(history_list)} messages")
                else:
                    # Old format: direct array of messages
                    history_list = history_data
                    print(f"  ✓ Using legacy history format with {len(history_list)} messages")
                
                # Append conversation history to system prompt
                if history_list and isinstance(history_list, list):
                    system_prompt += "--- CONVERSATION HISTORY ---\n"
                    for msg in history_list:
                        role = "User" if msg.get("role") == "user" else "Assistant"
                        text = msg.get("text", "")
                        system_prompt += f"{role}: {text}\n"
                        print(f"  → {role}: {text[:50]}...")  # DEBUG: show snippet
                    system_prompt += "--- END HISTORY ---\n\n"
                    
            except Exception as e:
                print(f"⚠️ History Parse Error: {e}")

        system_prompt += "IMPORTANT: Keep your response concise (under 50 words)."

        # --- 4. SPEECH TO TEXT (STT) ---
        user_text = None
        for attempt in range(3):
            try:
                source = {"buffer": audio_file}
                # Expect WebM/Opus from browser MediaRecorder; fallback still works for mp3
                options = {"model": "nova-2", "smart_format": True, "mimetype": "audio/webm"}
                
                # Deepgram Call
                response = deepgram.listen.prerecorded.v("1").transcribe_file(source, options)
                user_text = response["results"]["channels"][0]["alternatives"][0]["transcript"]
                
                if user_text: break
            except Exception as e:
                print(f"⚠️ STT Retry ({attempt+1}/3) Error: {e}")
                time.sleep(1) # Wait 1 sec before retry

        if not user_text: 
            return {"error": "Could not understand audio (STT Failed)."}
        
        print(f"🎤 User: {user_text}")

        # --- 5. LLM (Intelligence) ---
        ai_text = ""
        try:
            if llm_provider == "groq":
                completion = groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_text}
                    ],
                    model="llama-3.1-8b-instant",
                )
                ai_text = completion.choices[0].message.content
            
            elif llm_provider == "gemini":
                # Ensure you use the correct model name found in your check_models.py
                model = genai.GenerativeModel('gemini-2.0-flash') 
                response = model.generate_content(f"{system_prompt}\n\nUser: {user_text}")
                ai_text = response.text

        except Exception as e:
            print(f"❌ LLM Error: {e}")
            return {"error": f"LLM Failed: {e}"}

        print(f"🤖 AI: {ai_text}")

        # --- 6. TEXT TO SPEECH (TTS) ---
        audio_data = None
        
        if tts_provider == "edge":
            try:
                edge_voice = voice_model if "Neural" in voice_model else "en-US-AriaNeural"
                communicate = edge_tts.Communicate(ai_text, edge_voice)
                await communicate.save(temp_filename)
                with open(temp_filename, "rb") as f: audio_data = f.read()
            except Exception as e:
                print(f"❌ Edge TTS Error: {e}")

        elif tts_provider == "deepgram":
            try:
                dg_voice = voice_model if "aura" in voice_model else "aura-asteria-en"
                options = SpeakOptions(model=dg_voice)
                response = deepgram.speak.v("1").save(temp_filename, {"text": ai_text}, options)
                with open(temp_filename, "rb") as f: audio_data = f.read()
            except Exception as e:
                print(f"❌ Deepgram TTS Error: {e}")

        if not audio_data:
            return {"error": "TTS Generation Failed."}

        return {
            "user_text": user_text,
            "ai_text": ai_text,
            "audio_data": audio_data
        }

    except Exception as e:
        print(f"❌ Critical Pipeline Error: {e}")
        return {"error": str(e)}
        
    finally:
        if os.path.exists(temp_filename):
            try: os.remove(temp_filename)
            except: pass