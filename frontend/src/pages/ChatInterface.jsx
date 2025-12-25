import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Mic, ArrowLeft, Square, Volume2, Loader2, MoreVertical, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ChatInterface = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  
  // States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [agentName, setAgentName] = useState("Agent");
  const [isSilent, setIsSilent] = useState(false);
  const [silenceTimer, setSilenceTimer] = useState(null);
  
  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const silenceCountRef = useRef(0);

  // --- AUTO-SCROLL TO BOTTOM ---
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [transcript]);

  // --- AUTO-START RECORDING ON MOUNT ---
  useEffect(() => {
    startRecording();
  }, []);

  // --- SILENCE DETECTION ---
  const setupSilenceDetection = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    
    microphone.connect(analyser);
    analyserRef.current = analyser;
    audioContextRef.current = audioContext;

    const detectSilence = () => {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      
      // If volume < 30 (silence threshold)
      if (average < 30) {
        silenceCountRef.current += 1;
        
        // If silent for 1.5+ seconds (15 checks at ~100ms each), stop recording
        if (silenceCountRef.current > 15 && isRecording) {
          console.log("Silence detected, stopping recording...");
          stopRecording();
          return;
        }
      } else {
        silenceCountRef.current = 0; // Reset on sound
      }

      if (isRecording) {
        requestAnimationFrame(detectSilence);
      }
    };

    detectSilence();
  };

  // --- 1. RECORDING LOGIC ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      silenceCountRef.current = 0;

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = handleStopRecording;
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Setup silence detection
      setupSilenceDetection(stream);
    } catch (error) {
      console.error("Microphone Error:", error);
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleStopRecording = async () => {
    setIsProcessing(true);
    
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
    const formData = new FormData();
    formData.append("file", audioBlob, "voice_input.mp3");
    formData.append("agent_id", agentId); 

    try {
      // 1. Send to Backend
      const response = await axios.post("http://localhost:8000/chat/audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob", 
      });

      // 2. Extract Headers (Transcripts) and decode them
      const userText = decodeURIComponent(response.headers["x-user-text"] || "");
      const aiText = decodeURIComponent(response.headers["x-ai-text"] || "");

      // 3. Update Transcript UI
      if (userText) {
          addMessage("user", userText);
      }
      
      // 4. Play Audio Response & Auto-listen after
      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        // Auto-start listening after AI finishes speaking
        if (aiText) {
          addMessage("ai", aiText);
        }
        setTimeout(() => startRecording(), 500);
      };
      
      audio.play();

    } catch (error) {
      console.error("Error:", error);
      alert("Failed to process voice command. See console.");
      // Retry listening on error
      setTimeout(() => startRecording(), 1000);
    } finally {
      setIsProcessing(false);
    }
  };

  const addMessage = (role, text) => {
    setTranscript(prev => [...prev, { role, text, timestamp: new Date() }]);
  };

  const handleBack = () => {
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause(); // Stop audio if leaving
    }
    navigate("/dashboard");
  }

  // --- RENDER ---
  return (
    <div className="h-screen w-full bg-white text-gray-900 overflow-hidden flex flex-col">
      
      {/* HEADER - Minimal */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
        <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={22} className="text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{agentName}</h1>
        <div className="w-8" /> {/* Spacer for alignment */}
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col items-center justify-between py-8 px-6">
        
        {/* CHAT TRANSCRIPT */}
        <div ref={chatContainerRef} className="w-full max-w-2xl flex-1 overflow-y-auto flex flex-col justify-end space-y-4 mb-8">
          <AnimatePresence>
            {transcript.length === 0 && !isProcessing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <p className="text-gray-400 text-base">Start speaking...</p>
              </motion.div>
            )}
            
            {transcript.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] px-4 py-2.5 rounded-lg ${
                  msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* VOICE VISUALIZER - Minimal */}
        <div className="flex flex-col items-center gap-6">
          {/* Simple Pulsing Circle */}
          <motion.div 
            animate={{ 
              scale: isRecording ? 1.1 : 1,
            }}
            transition={{ type: "spring", stiffness: 300 }}
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording ? 'bg-blue-600 shadow-lg shadow-blue-300' : 
              isPlaying ? 'bg-purple-600 shadow-lg shadow-purple-300' : 
              isProcessing ? 'bg-amber-500 shadow-lg shadow-amber-300' : 
              'bg-gray-200'
            }`}
          >
            {isProcessing ? (
              <Loader2 size={40} className="animate-spin text-white" />
            ) : isPlaying ? (
              <Volume2 size={40} className="text-white" />
            ) : (
              <Mic size={40} className={isRecording ? 'text-white' : 'text-gray-600'} />
            )}
          </motion.div>

          {/* State Label */}
          <p className="text-sm text-gray-500 font-medium h-6">
            {isRecording ? "Listening" : 
             isProcessing ? "Processing" : 
             isPlaying ? "Speaking" : ""}
          </p>
        </div>
      </div>

      {/* BOTTOM BUTTON */}
      <div className="px-6 pb-8 flex justify-center">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`h-16 w-16 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 ${
            isRecording 
            ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-300 text-white' 
            : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-300 text-white'
          }`}
        >
          {isRecording ? <Square size={28} fill="currentColor" /> : <Mic size={28} />}
        </button>
      </div>

      {/* Custom Scrollbar */}
      <style>{`
        div::-webkit-scrollbar {
          width: 4px;
        }
        div::-webkit-scrollbar-track {
          background: transparent;
        }
        div::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 2px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
};

export default ChatInterface;