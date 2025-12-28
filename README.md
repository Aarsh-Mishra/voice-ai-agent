# 🎙️ Voice AI Agent

A professional, real-time Voice AI Agent capable of holding natural conversations with context awareness. Built with a modern React frontend and a robust FastAPI backend, it leverages cutting-edge AI models for Speech-to-Text (STT), Large Language Models (LLM), and Text-to-Speech (TTS).

![Project Status](https://img.shields.io/badge/Status-Active-success)

## 🌟 Features

-   **Real-time Voice Interaction:** Talk to the AI naturally with low-latency responses.
-   **Adaptive Voice Activity Detection (VAD):** Smart microphone handling that filters background noise and detects human speech dynamically.
-   **Context-Aware Conversations:** The AI remembers conversation history for a seamless chat experience.
-   **Multi-Agent Support:** Create and configure different AI personas with unique system prompts.
-   **User Authentication:** Secure Login and Signup functionality.
-   **Dashboard:** Manage your agents and view conversation logs.
-   **Modular AI Pipeline:**
    -   **STT:** Deepgram Nova-2 (High accuracy & speed).
    -   **LLM:** Groq (Llama 3) & Google Gemini (Flash 2.0).
    -   **TTS:** Deepgram Aura & Edge TTS (Natural sounding voices).

## 🛠️ Tech Stack

### Frontend
-   **Framework:** React (Vite)
-   **Styling:** Tailwind CSS
-   **Audio Processing:** Web Audio API (Browser-native)
-   **State Management:** React Hooks & Refs
-   **Routing:** React Router DOM

### Backend
-   **Framework:** FastAPI (Python)
-   **Database:** MongoDB (Motor AsyncIO)
-   **Server:** Uvicorn
-   **Authentication:** JWT (JSON Web Tokens)

## 🚀 Installation & Setup

Follow these steps to get the project running locally.

### Prerequisites
-   Node.js (v18+)
-   Python (v3.10+)
-   MongoDB (Local or Atlas URI)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/voice-ai-agent.git
cd voice-ai-agent
```

### 2. Backend Setup

Navigate to the backend folder, create a virtual environment, and install dependencies.

```bash
cd backend
python -m venv venv

# Activate Virtual Environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install Dependencies
pip install -r requirements.txt
```

**Environment Variables:**
Create a `.env` file in the `backend/` directory with the following keys:

```env
MONGO_URI=mongodb://localhost:27017/voice_agent_db
SECRET_KEY=your_super_secret_jwt_key
DEEPGRAM_API_KEY=your_deepgram_api_key
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
```

**Start the Backend Server:**
```bash
uvicorn main:app --reload
```
*The server will start on `http://127.0.0.1:8000`*

### 3. Frontend Setup

Open a new terminal, navigate to the frontend folder, and install dependencies.

```bash
cd frontend
npm install
```

**Start the Frontend Server:**
```bash
npm run dev
```
*The app will run on `http://localhost:5173` (or similar)*

## 📖 Usage Guide

1.  **Sign Up/Login:** Create an account to access the dashboard.
2.  **Create an Agent:** Go to the dashboard and configure a new agent (e.g., "Helpful Assistant").
3.  **Start Chatting:** Click on the agent to enter the Chat Interface.
4.  **Enable Microphone:** Allow browser permissions.
5.  **Speak:** The AI will listen to your voice (Adaptive VAD) and respond instantly.
6.  **Manual Override:** Click the microphone icon to manually stop listening if needed.

## 📂 Project Structure

```
voice-ai-agent/
├── backend/             # FastAPI Server
│   ├── main.py          # Entry point
│   ├── services.py      # AI Pipeline (STT -> LLM -> TTS)
│   ├── agents.py        # Agent management routes
│   ├── auth.py          # Authentication routes
│   ├── database.py      # MongoDB connection
│   └── requirements.txt # Python dependencies
│
├── frontend/            # React Client
│   ├── src/
│   │   ├── pages/       # Dashboard, ChatInterface, Login
│   │   ├── App.jsx      # Main component
│   │   └── main.jsx     # Entry point
│   ├── package.json     # Node dependencies
│   └── vite.config.js   # Vite configuration
│
└── README.md            # Project Documentation
```

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request.
