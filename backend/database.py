import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    print("WARNING: MONGO_URI is not set in .env file")

# Create the Async Client
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)

# Connect to a database named 'voice_agent_db'
db = client.voice_agent_db

# Helper to verify connection
async def test_db_connection():
    try:
        await client.admin.command('ping')
        print("✅ MongoDB Connected Successfully!")
    except Exception as e:
        print(f"❌ MongoDB Connection Failed: {e}")