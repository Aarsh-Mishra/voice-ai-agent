// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, LogOut, Bot, Mic } from "lucide-react";

const Dashboard = () => {
  const [agents, setAgents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    system_prompt: "",
    voice_model: "aura-asteria-en",
  });
  const navigate = useNavigate();

  // --- 1. LOAD AGENTS ON START ---
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
      console.error("Error fetching agents:", error);
      if (error.response && error.response.status === 401) {
        handleLogout(); // Token expired
      }
    }
  };

  // --- 2. ACTIONS ---
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
      
      // Reset form and reload list
      setShowCreateForm(false);
      setNewAgent({ name: "", system_prompt: "", voice_model: "aura-asteria-en" });
      fetchAgents();
    } catch (error) {
      alert("Failed to create agent. Check console for details.");
      console.error(error);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:8000/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAgents(); // Refresh list
    } catch (error) {
      alert("Failed to delete agent");
      console.error(error);
    }
  };

  // --- 3. RENDER UI ---
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Bot className="text-blue-600" /> My AI Agents
        </h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-red-600 shadow-sm border border-red-100 hover:bg-red-50 transition"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>

      {/* Grid of Agents */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        {/* Card 1: The "Create New" Button */}
        <div
          onClick={() => setShowCreateForm(true)}
          className="flex h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white transition hover:border-blue-500 hover:bg-blue-50"
        >
          <div className="mb-4 rounded-full bg-blue-100 p-4 text-blue-600">
            <Plus size={32} />
          </div>
          <p className="font-semibold text-gray-500">Create New Agent</p>
        </div>

        {/* Existing Agents List */}
        {agents.map((agent) => (
          <div key={agent.id} className="relative flex h-64 flex-col justify-between rounded-xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <h3 className="text-xl font-bold text-gray-800">{agent.name}</h3>
              </div>
              <p className="mb-4 text-sm text-gray-500 line-clamp-3">
                "{agent.system_prompt}"
              </p>
              <div className="flex items-center gap-2 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded w-fit">
                <Mic size={12} /> {agent.voice_model}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button 
                onClick={() => handleDeleteAgent(agent.id)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition"
              >
                <Trash2 size={16} /> Delete
              </button>
              {/* We will add the Chat button in the final step */}
            </div>
          </div>
        ))}
      </div>

      {/* Create Agent Modal (Simple Overlay) */}
      {showCreateForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">New Agent</h2>
            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  required
                  className="w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Sarcastic Bot"
                  value={newAgent.name}
                  onChange={e => setNewAgent({...newAgent, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Personality (Prompt)</label>
                <textarea
                  required
                  rows="3"
                  className="w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. You are a helpful assistant who loves history..."
                  value={newAgent.system_prompt}
                  onChange={e => setNewAgent({...newAgent, system_prompt: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Voice</label>
                <select
                  className="w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newAgent.voice_model}
                  onChange={e => setNewAgent({...newAgent, voice_model: e.target.value})}
                >
                  <option value="aura-asteria-en">Asteria (Female)</option>
                  <option value="aura-orion-en">Orion (Male)</option>
                  <option value="aura-luna-en">Luna (Female)</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 rounded-lg border border-gray-300 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700"
                >
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;