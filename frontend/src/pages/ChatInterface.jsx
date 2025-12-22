import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Mic, ArrowLeft, StopCircle, Play, Loader2 } from "lucide-react";

const ChatInterface = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]); // Stores chat history
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- 1. START RECORDING ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = handleStopRecording;
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Microphone access denied");
    }
  };

  // --- 2. STOP & SEND ---
  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleStopRecording = async () => {
    setIsLoading(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
    const formData = new FormData();
    formData.append("file", audioBlob, "voice_input.mp3");

    // Add a temp "Thinking..." message
    setMessages((prev) => [...prev, { role: "user", type: "audio", status: "sent" }]);

    try {
      // Send to Backend
      // Note: We are using the main chat endpoint. 
      // In a real app, you'd pass the 'agentId' to the backend to load specific prompts.
      // For now, we will use the default backend pipeline we built.
      const response = await axios.post("http://localhost:8000/chat/audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob", // Important for receiving audio
      });

      // Create URL for the AI's audio response
      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      
      setMessages((prev) => [
        ...prev, 
        { role: "ai", type: "audio", src: audioUrl }
      ]);
      
      audio.play();

    } catch (error) {
      console.error("Error processing voice:", error);
      alert("Failed to process voice command");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* Header */}
      <div className="flex items-center bg-white p-4 shadow-sm">
        <button onClick={() => navigate("/dashboard")} className="mr-4 rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Voice Chat</h1>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
                <p>Tap the microphone to start talking.</p>
            </div>
        )}
        
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`rounded-xl p-4 max-w-xs ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-800 shadow-sm"}`}>
               {msg.role === "user" ? "🎤 Voice Input Sent" : (
                   <div className="flex items-center gap-2">
                       <Play size={16} /> <span>Audio Response</span>
                   </div>
               )}
            </div>
          </div>
        ))}
        
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-2 text-gray-500">
                    <Loader2 className="animate-spin" size={16} /> Thinking...
                </div>
            </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white p-8 flex justify-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
            isRecording ? "bg-red-500 animate-pulse shadow-red-300" : "bg-blue-600 hover:bg-blue-700 shadow-blue-300"
          } text-white shadow-lg`}
        >
          {isRecording ? <StopCircle size={40} /> : <Mic size={40} />}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;