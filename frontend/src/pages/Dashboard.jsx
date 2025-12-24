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
    tts_provider: "deepgram"
  });
  
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
          <StatCard title="Active Agents" value={agents.length} icon={<Bot className="text-blue-500" />} />
          <StatCard title="Total Conversations" value="0" icon={<MessageSquare className="text-purple-500" />} />
          <StatCard title="Voice Usage" value="0m" icon={<Mic className="text-green-500" />} />
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Start Guide</h3>
        <ul className="space-y-3 text-gray-600">
            <li className="flex items-center gap-2"><div className="h-2 w-2 bg-blue-500 rounded-full"></div> Go to "My Agents" tab to create your first personality.</li>
            <li className="flex items-center gap-2"><div className="h-2 w-2 bg-purple-500 rounded-full"></div> Click the "Chat" button on an agent card to start talking.</li>
            <li className="flex items-center gap-2"><div className="h-2 w-2 bg-green-500 rounded-full"></div> Use the "Settings" tab to manage your account.</li>
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

  const SettingsView = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Settings className="text-gray-400" /> Account Settings
        </h3>
        
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                        <User size={24} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-800">Admin User</p>
                        <p className="text-sm text-gray-500">admin@voiceai.com</p>
                    </div>
                </div>
                <button className="text-blue-600 text-sm font-medium hover:underline">Edit</button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-800">API Keys</p>
                        <p className="text-sm text-gray-500">Managed in .env file</p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Active</div>
            </div>

            <div className="pt-4 border-t border-gray-100">
                <button onClick={handleLogout} className="w-full py-3 rounded-xl border border-red-100 text-red-600 font-medium hover:bg-red-50 transition flex items-center justify-center gap-2">
                    <LogOut size={18} /> Sign Out
                </button>
            </div>
        </div>
    </motion.div>
  );

  return (
    <div className="flex min-h-screen bg-[#F3F4F6] text-gray-900 font-sans">
      {/* --- SIDEBAR --- */}
      <motion.aside 
        initial={{ x: -100 }} animate={{ x: 0 }}
        className="w-20 lg:w-64 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex"
      >
        <div>
          <div className="p-6 flex items-center gap-3 text-blue-600">
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

        <div className="p-4 border-t border-gray-100">
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
            <h1 className="text-3xl font-bold text-gray-900 capitalize">{activeTab.replace('_', ' ')}</h1>
            <p className="text-gray-500 mt-1">Manage your voice assistants and conversations.</p>
          </div>
          
          {activeTab === 'agents' && (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-200 flex items-center gap-2 transition"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800">Create New Agent</h3>
                <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              
              <form onSubmit={handleCreateAgent} className="p-6 space-y-4">
                <InputGroup label="Name" placeholder="e.g. Jarvis" value={newAgent.name} 
                  onChange={e => setNewAgent({...newAgent, name: e.target.value})} />
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">System Prompt</label>
                  <textarea required rows="3" className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="e.g. You are a helpful assistant..."
                    value={newAgent.system_prompt}
                    onChange={e => setNewAgent({...newAgent, system_prompt: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SelectGroup label="STT Provider" value={newAgent.stt_provider} 
                    onChange={e => setNewAgent({...newAgent, stt_provider: e.target.value})}>
                    <option value="deepgram">Deepgram (Fast)</option>
                    <option value="openai">OpenAI Whisper</option>
                  </SelectGroup>
                  <SelectGroup label="LLM Provider" value={newAgent.llm_provider} 
                    onChange={e => setNewAgent({...newAgent, llm_provider: e.target.value})}>
                    <option value="groq">Groq (Llama 3)</option>
                    <option value="openai">OpenAI (GPT-4)</option>
                  </SelectGroup>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SelectGroup label="TTS Provider" value={newAgent.tts_provider} 
                    onChange={e => setNewAgent({...newAgent, tts_provider: e.target.value})}>
                    <option value="deepgram">Deepgram Aura</option>
                    <option value="elevenlabs">ElevenLabs</option>
                  </SelectGroup>
                  <SelectGroup label="Voice Model" value={newAgent.voice_model} 
                    onChange={e => setNewAgent({...newAgent, voice_model: e.target.value})}>
                    <option value="aura-asteria-en">Asteria (Female)</option>
                    <option value="aura-orion-en">Orion (Male)</option>
                  </SelectGroup>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-600 font-medium text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition">Create Agent</button>
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
    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition ${active ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
  >
    {icon} <span className="hidden lg:block">{label}</span>
  </div>
);

const StatCard = ({ title, value, icon }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800 mt-1">{value}</h3>
    </div>
    <div className="p-3 bg-gray-50 rounded-xl">{icon}</div>
  </div>
);

const AgentCard = ({ agent, index, onDelete, onClick }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    onClick={onClick}
    className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition">
      <button onClick={onDelete} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={16} /></button>
    </div>
    
    <div className="flex items-center gap-4 mb-4">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
        <Bot size={24} />
      </div>
      <div>
        <h3 className="font-bold text-lg text-gray-800">{agent.name}</h3>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{agent.llm_provider}</p>
      </div>
    </div>
    
    <p className="text-sm text-gray-500 line-clamp-2 mb-6 h-10 leading-relaxed">
      {agent.system_prompt}
    </p>

    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
        <Mic size={12} /> {agent.voice_model}
      </div>
      <span className="text-blue-600 text-sm font-medium group-hover:underline">Chat Now →</span>
    </div>
  </motion.div>
);

const InputGroup = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
    <input required className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition" {...props} />
  </div>
);

const SelectGroup = ({ label, children, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
    <div className="relative">
      <select className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition" {...props}>
        {children}
      </select>
      <div className="absolute right-3 top-3 text-gray-400 pointer-events-none"><MoreVertical size={16} /></div>
    </div>
  </div>
);

export default Dashboard;