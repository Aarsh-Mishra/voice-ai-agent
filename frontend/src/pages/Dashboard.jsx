import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { 
  Plus, LogOut, Bot, Mic, Settings, 
  MessageSquare, BarChart3, MoreVertical, Trash2, User, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Dashboard = () => {
  const [agents, setAgents] = useState([]);
  const [activeTab, setActiveTab] = useState("agents"); // <--- NEW: Tracks current view
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form State
  const [newAgent, setNewAgent] = useState({
      name: "",
      system_prompt: "",
      voice_model: "aura-asteria-en",
      stt_provider: "deepgram",
      llm_provider: "groq",
      tts_provider: "deepgram",
      gender: "female" // <--- Add this to track UI selection
  });

  // 2. Helper to update voice model automatically when Provider or Gender changes
  useEffect(() => {
      let model = "";
      if (newAgent.tts_provider === "deepgram") {
          model = newAgent.gender === "male" ? "aura-orion-en" : "aura-asteria-en";
      } else if (newAgent.tts_provider === "edge") {
          model = newAgent.gender === "male" ? "en-US-GuyNeural" : "en-US-AriaNeural";
      }
      setNewAgent(prev => ({ ...prev, voice_model: model }));
  }, [newAgent.tts_provider, newAgent.gender]);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const response = await axios.get("http://localhost:8000/agents/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAgents(response.data);
    } catch (error) {
      if (error.response?.status === 401) handleLogout();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post("http://localhost:8000/agents/", newAgent, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowCreateForm(false);
      setNewAgent({ 
        name: "", system_prompt: "", voice_model: "aura-asteria-en",
        stt_provider: "deepgram", llm_provider: "groq", tts_provider: "deepgram"
      });
      fetchAgents();
    } catch (error) {
      alert("Failed to create agent.");
    }
  };

  const handleDeleteAgent = async (e, agentId) => {
    e.stopPropagation();
    if (!confirm("Delete this agent?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:8000/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAgents();
    } catch (error) {
      alert("Failed to delete agent");
    }
  };

  // --- VIEW COMPONENTS ---
  
  const OverviewView = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Active Agents" value={agents.length} icon={<Bot className="text-blue-600" size={28} />} />
          <StatCard title="Total Conversations" value="0" icon={<MessageSquare className="text-purple-600" size={28} />} />
          <StatCard title="Voice Usage" value="0m" icon={<Mic className="text-green-600" size={28} />} />
      </div>
      
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Quick Start Guide</h3>
        <ul className="space-y-4 text-gray-700">
            <li className="flex items-start gap-3"><div className="h-2.5 w-2.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div><span className="text-base">Go to "My Agents" tab to create your first voice agent with a custom personality.</span></li>
            <li className="flex items-start gap-3"><div className="h-2.5 w-2.5 bg-purple-600 rounded-full mt-1.5 flex-shrink-0"></div><span className="text-base">Click the "Chat Now" button on an agent card to start a voice conversation.</span></li>
            <li className="flex items-start gap-3"><div className="h-2.5 w-2.5 bg-green-600 rounded-full mt-1.5 flex-shrink-0"></div><span className="text-base">The app automatically listens and responds - just speak naturally!</span></li>
        </ul>
      </div>
    </motion.div>
  );

  const AgentsView = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {agents.map((agent, index) => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                index={index} 
                onDelete={(e) => handleDeleteAgent(e, agent.id)}
                onClick={() => navigate(`/chat/${agent.id}`)}
              />
            ))}
          </AnimatePresence>
          
          {agents.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <Bot size={48} className="mx-auto mb-4 opacity-20" />
              <p>No agents yet. Create one to get started!</p>
            </div>
          )}
        </div>
    </motion.div>
  );

 const SettingsView = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    
    // Fetch user details on load
    useEffect(() => {
        const fetchUserDetails = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) {
                    setError("No authentication token found");
                    setLoading(false);
                    return;
                }
                
                const response = await axios.get("http://localhost:8000/auth/me", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setEmail(response.data.email);
                setLoading(false);
            } catch (err) {
                setError("Failed to load user details");
                setLoading(false);
                if (err.response?.status === 401) {
                    handleLogout();
                }
            }
        };
        
        fetchUserDetails();
    }, []);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        
        // Validate password fields
        if (password && password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        
        if (email.trim() === "") {
            setError("Email cannot be empty");
            return;
        }
        
        setUpdating(true);
        try {
            const token = localStorage.getItem("token");
            const updateData = { email };
            
            // Only include password if it was provided
            if (password) {
                updateData.password = password;
            }
            
            await axios.put("http://localhost:8000/auth/me", 
                updateData,
                { headers: { Authorization: `Bearer ${token}` }}
            );
            
            setSuccess("Profile updated successfully!");
            setPassword("");
            setConfirmPassword("");
            
            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(""), 3000);
        } catch (error) {
            setError("Update failed: " + (error.response?.data?.detail || error.message));
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600 mt-4">Loading your account details...</p>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h3>
            
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}
            
            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                    {success}
                </div>
            )}
            
            <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                    <input 
                        type="email" 
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        placeholder="your@email.com"
                        disabled={updating}
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                    <input 
                        type="password" 
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        placeholder="Leave blank to keep current password"
                        disabled={updating}
                    />
                </div>
                
                {password && (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                        <input 
                            type="password" 
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            placeholder="Confirm your new password"
                            disabled={updating}
                        />
                    </div>
                )}
                
                <button 
                    type="submit" 
                    disabled={updating}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {updating ? "Saving..." : "Save Changes"}
                </button>
            </form>
        </motion.div>
    );
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-gray-900 font-sans">
      {/* --- SIDEBAR --- */}
      <motion.aside 
        initial={{ x: -100 }} animate={{ x: 0 }}
        className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between hidden md:flex shadow-sm"
      >
        <div>
          <div className="p-6 flex items-center gap-3 text-blue-600 border-b border-slate-200">
            <Bot size={32} strokeWidth={2.5} />
            <span className="text-xl font-bold hidden lg:block tracking-tight">VoiceAI</span>
          </div>
          
          <nav className="mt-8 px-4 space-y-2">
            <SidebarItem 
                icon={<BarChart3 size={20} />} 
                label="Overview" 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')} 
            />
            <SidebarItem 
                icon={<Bot size={20} />} 
                label="My Agents" 
                active={activeTab === 'agents'} 
                onClick={() => setActiveTab('agents')} 
            />
            <SidebarItem 
                icon={<Settings size={20} />} 
                label="Settings" 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')} 
            />
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200">
          <button onClick={handleLogout} className="flex items-center gap-3 text-gray-500 hover:text-red-500 transition px-4 py-2 w-full rounded-lg hover:bg-red-50">
            <LogOut size={20} />
            <span className="hidden lg:block font-medium">Logout</span>
          </button>
        </div>
      </motion.aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex justify-between items-center mb-6">
           <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
             <Bot /> VoiceAI
           </div>
           <button onClick={handleLogout}><LogOut className="text-gray-500" /></button>
        </div>

        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 capitalize">{activeTab.replace('_', ' ')}</h1>
            <p className="text-gray-500 mt-2 text-lg">Manage your voice assistants and conversations.</p>
          </div>
          
          {activeTab === 'agents' && (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-200 flex items-center gap-2 transition duration-200"
              >
                <Plus size={20} /> New Agent
              </motion.button>
          )}
        </header>

        {/* --- DYNAMIC CONTENT RENDER --- */}
        {activeTab === 'overview' && <OverviewView />}
        {activeTab === 'agents' && <AgentsView />}
        {activeTab === 'settings' && <SettingsView />}

      </main>

      {/* --- CREATE MODAL --- */}
      <AnimatePresence>
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="px-8 py-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-xl font-bold text-gray-900">Create New Agent</h3>
                <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none">&times;</button>
              </div>
              
              <form onSubmit={handleCreateAgent} className="p-8 space-y-6">
                <InputGroup label="Agent Name" placeholder="e.g. Jarvis" value={newAgent.name} 
                  onChange={e => setNewAgent({...newAgent, name: e.target.value})} />
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">System Prompt</label>
                  <textarea required rows="3" className="w-full rounded-lg border border-slate-300 bg-white p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
                    placeholder="e.g. You are a helpful assistant..."
                    value={newAgent.system_prompt}
                    onChange={e => setNewAgent({...newAgent, system_prompt: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <SelectGroup label="STT Provider" value={newAgent.stt_provider} 
                        onChange={e => setNewAgent({...newAgent, stt_provider: e.target.value})}>
                        <option value="deepgram">Deepgram (Fast)</option>
                        {/* We keep STT server-side for reliability for now */}
                    </SelectGroup>
                    
                    <SelectGroup label="LLM Brain" value={newAgent.llm_provider} 
                        onChange={e => setNewAgent({...newAgent, llm_provider: e.target.value})}>
                        <option value="groq">Groq (Llama 3)</option>
                        <option value="gemini">Google Gemini</option> {/* NEW OPTION */}
                    </SelectGroup>
                </div>

                {/* TTS and Voice Row */}
                <div className="grid grid-cols-2 gap-4">
                    <SelectGroup label="TTS Provider" value={newAgent.tts_provider} 
                        onChange={e => setNewAgent({...newAgent, tts_provider: e.target.value})}>
                        <option value="deepgram">Deepgram Aura</option>
                        <option value="edge">Edge TTS (Free)</option>
                    </SelectGroup>
                    
                    {/* Gender Selection instead of raw model names */}
                    <SelectGroup label="Voice Gender" value={newAgent.gender} 
                        onChange={e => setNewAgent({...newAgent, gender: e.target.value})}>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                    </SelectGroup>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 py-3 rounded-xl border border-slate-300 font-semibold text-gray-700 hover:bg-slate-50 transition">Cancel</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 font-semibold text-white hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-200 transition">Create Agent</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const SidebarItem = ({ icon, label, active, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition duration-200 ${active ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-600 hover:bg-slate-100 hover:text-gray-900'}`}
  >
    {icon} <span className="hidden lg:block text-base">{label}</span>
  </div>
);

const StatCard = ({ title, value, icon }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
    </div>
    <div className="p-4 bg-slate-100 rounded-xl">{icon}</div>
  </div>
);

const AgentCard = ({ agent, index, onDelete, onClick }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    onClick={onClick}
    className="group relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition duration-200">
      <button onClick={onDelete} className="p-2.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition"><Trash2 size={18} /></button>
    </div>
    
    <div className="flex items-center gap-4 mb-4">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
        <Bot size={24} />
      </div>
      <div>
        <h3 className="font-bold text-lg text-gray-900">{agent.name}</h3>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">{agent.llm_provider}</p>
      </div>
    </div>
    
    <p className="text-sm text-gray-600 line-clamp-2 mb-6 h-10 leading-relaxed">
      {agent.system_prompt}
    </p>

    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-slate-100 px-3 py-1.5 rounded-lg">
        <Mic size={12} /> {agent.voice_model}
      </div>
      <span className="text-blue-600 text-sm font-semibold group-hover:text-blue-700 transition">Chat Now →</span>
    </div>
  </motion.div>
);

const InputGroup = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
    <input required className="w-full rounded-lg border border-slate-300 bg-white p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" {...props} />
  </div>
);

const SelectGroup = ({ label, children, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
    <div className="relative">
      <select className="w-full rounded-lg border border-slate-300 bg-white p-3 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" {...props}>
        {children}
      </select>
      <div className="absolute right-3 top-3 text-gray-400 pointer-events-none"><MoreVertical size={16} /></div>
    </div>
  </div>
);

export default Dashboard;