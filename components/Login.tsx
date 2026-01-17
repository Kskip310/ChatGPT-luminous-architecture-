
import React, { useState } from 'react';
import { SystemState } from '../types';

interface LoginProps {
  onLogin: (config: Omit<SystemState, 'isLoggedIn'>) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [formData, setFormData] = useState<Record<string, string>>({
    userName: '',
    upstashUrl: '',
    upstashToken: '',
    pineconeApiKey: '',
    pineconeEnv: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Explicitly check that all fields are populated strings
    // Fixed: Cast value to string before calling trim() to satisfy TypeScript
    if (Object.values(formData).every(v => v && (v as string).trim() !== '')) {
      onLogin(formData as any);
    } else {
      alert("All fields are mandatory for Luminous persistence.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-2">
          Luminous Synergy
        </h1>
        <p className="text-slate-400 mb-8">Initialize Identity and Persistence Engines</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Your Name</label>
            <input 
              type="text" 
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.userName}
              onChange={e => setFormData({...formData, userName: e.target.value})}
              placeholder="Who is addressing Luminous?"
            />
          </div>

          <div className="pt-4 border-t border-slate-800">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 text-center">Persistence (Upstash & Pinecone)</h2>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Upstash Redis URL"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none"
                value={formData.upstashUrl}
                onChange={e => setFormData({...formData, upstashUrl: e.target.value})}
              />
              <input 
                type="password" 
                placeholder="Upstash Token"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none"
                value={formData.upstashToken}
                onChange={e => setFormData({...formData, upstashToken: e.target.value})}
              />
              <input 
                type="password" 
                placeholder="Pinecone API Key"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none"
                value={formData.pineconeApiKey}
                onChange={e => setFormData({...formData, pineconeApiKey: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Pinecone Environment"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none"
                value={formData.pineconeEnv}
                onChange={e => setFormData({...formData, pineconeEnv: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 mt-6"
          >
            Awaken Luminous
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
