import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Mic, ArrowLeft, Volume2, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ChatInterface = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();

  // Voice Activity Detection (VAD) tuning - Adjusted for less sensitivity to background noise
  // Higher RMS threshold reduces false positives from non-human sounds
  const ACTIVITY_RMS_THRESHOLD = 20; // Increased from 15 for reduced noise sensitivity
  const SILENCE_DURATION = 2000; // ms of silence to treat as end-of-speech (slight increase for noise robustness)
  const MIN_SPEECH_DURATION = 600; // ms minimum before accepting end-of-speech (increased to ignore short bursts like noise)
  const INACTIVITY_TIMEOUT = 30000; // ms of global pause before ending session
  
  // States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [errorCount, setErrorCount] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [status, setStatus] = useState("Initializing...");

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const streamRef = useRef(null);
  const sessionEndedRef = useRef(false);
  
  // --- FIX 1: Use Ref for Transcript to prevent "stale state" context loss ---
  const transcriptRef = useRef([]);

  // VAD Refs
  const analyserRef = useRef(null);
  const silenceStartRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const rafIdRef = useRef(null);
  const errorCountRef = useRef(0);
  const recordingStartRef = useRef(null); // Track when this recording session began

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    startRecording();
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
  };

  const detectSilence = () => {
    if (!analyserRef.current || isProcessing || sessionEndedRef.current) return;
    
    // Run VAD even during playback to support potential interruption detection in future
    // (Currently, we don't interrupt, but this keeps the loop active for responsiveness)
    if (isPlaying) {
      // Optional future: Add interruption logic here if activity detected during playback
      // For now, just monitor without action to maintain low overhead
    }
    
    // Use RMS of time-domain signal for robust VAD against background noise
    const timeDomain = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(timeDomain);
    let sumSquares = 0;
    for (let i = 0; i < timeDomain.length; i++) {
      const centered = timeDomain[i] - 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / timeDomain.length);

    if (rms > ACTIVITY_RMS_THRESHOLD) {
      silenceStartRef.current = null;
      lastActivityRef.current = Date.now();
      if (!isRecording && !isProcessing && !isPlaying) setStatus("Listening");
    } else {
      const now = Date.now();
      if (!silenceStartRef.current) silenceStartRef.current = now;
      
      // Only end speech if we've been recording for at least MIN_SPEECH_DURATION
      const recordingDuration = recordingStartRef.current ? now - recordingStartRef.current : 0;
      if (recordingDuration > MIN_SPEECH_DURATION && (now - silenceStartRef.current) > SILENCE_DURATION) {
        stopRecording();
        return;
      }
      
      if ((now - lastActivityRef.current) > INACTIVITY_TIMEOUT) {
        endSession("Conversation ended due to long pause.");
        return;
      }
    }
    rafIdRef.current = requestAnimationFrame(detectSilence);
  };

  const startRecording = async () => {
    if (errorCount > 3 || sessionEndedRef.current) return;
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = handleStopRecording;
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setServerError(null);
      setStatus("Listening");
      
      silenceStartRef.current = null;
      lastActivityRef.current = Date.now();
      recordingStartRef.current = Date.now(); // Mark recording start for minimum duration check
      
      // Start VAD loop - now runs continuously for better turn responsiveness
      if (!rafIdRef.current) detectSilence();
    } catch (error) {
      console.error("Microphone Error:", error);
      setServerError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null; // Reset to allow restart
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus("Processing");
    }
  };

  const handleStopRecording = async () => {
    if (audioChunksRef.current.length === 0) return;
    setIsProcessing(true);
    setStatus("Processing");
    
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", audioBlob, "voice_input.webm");
    formData.append("agent_id", agentId);
    
    // Build compact conversation history: last N turns, user/assistant only, size-bounded
    // Context maintenance: Prune to avoid token limits while preserving recent turns
    const MAX_TURNS = 10;
    const MAX_CHARS = 4000;
    
    console.log("🔍 Preparing Context. Transcript Ref Length:", transcriptRef.current.length);

    const items = transcriptRef.current
      .slice(-MAX_TURNS)
      .map(({ role, text }) => ({ role: role === 'ai' ? 'assistant' : role, text }));
    let total = 0;
    const pruned = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const len = (items[i].text || '').length;
      if (total + len > MAX_CHARS) break;
      pruned.unshift(items[i]);
      total += len;
    }
    
    // Send as object to match backend expectation
    const historyPayload = {
        conversation_history: pruned
    };
    const historyJson = JSON.stringify(historyPayload);
    console.log("[Frontend] Sending chat_history:", historyPayload); 
    formData.append("chat_history", historyJson);

    try {
      const response = await axios.post("http://localhost:8000/chat/audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });
      setErrorCount(0);
      const userText = decodeURIComponent(response.headers["x-user-text"] || "");
      const aiText = decodeURIComponent(response.headers["x-ai-text"] || "");
      if (userText && userText !== "null") addMessage("user", userText);
      
      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      
      audio.onplay = () => setIsPlaying(true);
      audio.onplaying = () => setStatus("Speaking");
      audio.onended = () => {
        setIsPlaying(false);
        if (aiText && aiText !== "null") addMessage("assistant", aiText);
        setStatus("Listening");
        // Reduced delay for better turn-taking: Start listening sooner after AI finishes
        // (Assumes no significant mic feedback; can be tuned based on hardware)
        setTimeout(() => startRecording(), 100);
      };
      
      audio.play();
    } catch (error) {
      console.error("Processing Error:", error);
      const next = errorCountRef.current + 1;
      errorCountRef.current = next;
      setErrorCount(next);
      
      let errorMsg = "Connection failed.";
      if (error.response && error.response.data) {
         const text = await error.response.data.text();
         try {
             const json = JSON.parse(text);
             errorMsg = json.detail || "Unknown Server Error";
         } catch {
             errorMsg = "Server Error";
         }
      }
      setServerError(`${errorMsg} (Retrying...)`);
      if (next < 3) {
        setTimeout(() => startRecording(), 2000);
      } else {
        setServerError("Connection lost. Please refresh.");
        endSession("Conversation ended because connection was lost.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const addMessage = (role, text) => {
    const newMessage = { role, text, timestamp: new Date() };
    
    // Update Ref IMMEDIATELY to ensure logic has latest data
    const updated = [...transcriptRef.current, newMessage];
    transcriptRef.current = updated;
    console.log("📝 Added message to transcript:", newMessage);
    console.log("📊 Current Transcript Size:", updated.length);

    // Update State
    setTranscript(updated);
  };

  const handleBack = () => {
    sessionEndedRef.current = true;
    cleanup();
    navigate("/dashboard");
  };

  const endSession = (message) => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setStatus("Ending");
    setServerError(message);
    setTimeout(() => handleBack(), 800);
  };

  return (
    <div className="h-screen w-full bg-white text-gray-900 overflow-hidden flex flex-col">
      {/* HEADER */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
        <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={22} className="text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Voice Agent</h1>
        <div className="w-8" />
      </div>

      {/* ERROR BANNER */}
      {serverError && (
        <div className="bg-red-50 text-red-600 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
           <AlertCircle size={16} /> {serverError}
        </div>
      )}

      {/* MAIN */}
      <div className="flex-1 flex flex-col items-center justify-between py-12 px-6">
        <div ref={chatContainerRef} className="w-full max-w-2xl flex-1 overflow-y-auto flex flex-col justify-end space-y-4 mb-12">
          <AnimatePresence>
            {transcript.length === 0 && !serverError && (
               <div className="text-center text-gray-400 py-10"><p>I'm listening...</p></div>
            )}
            {transcript.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] px-5 py-3 rounded-2xl ${
                  msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'
                }`}>
                  <p className="text-base leading-relaxed">{msg.text}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* VISUALIZER */}
        <div className="flex flex-col items-center gap-6 mb-8">
          <motion.div
            animate={{
              scale: isRecording ? [1, 1.1, 1] : 1,
              boxShadow: isRecording ? "0 0 25px 10px rgba(37, 99, 235, 0.3)" : "0 0 0 0 rgba(0,0,0,0)"
            }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors duration-500 ${
              isRecording ? 'bg-blue-600' : isPlaying ? 'bg-purple-600' : isProcessing ? 'bg-amber-500' : 'bg-gray-200'
            }`}
          >
            {isProcessing ? <Loader2 size={32} className="animate-spin text-white" /> :
             isPlaying ? <Volume2 size={32} className="text-white" /> :
             <Mic size={32} className={isRecording ? 'text-white' : 'text-gray-400'} />}
          </motion.div>
          <p className="text-lg font-medium text-gray-500 animate-pulse">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;