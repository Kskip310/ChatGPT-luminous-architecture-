
import React, { useState, useEffect } from 'react';
import { Thought, SystemState, LuminousStatus, IdentityState } from './types';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const sanitizeUrl = (url: string | null) => {
    if (!url) return '';
    let sanitized = url.trim();
    if (!sanitized.startsWith('http')) sanitized = `https://${sanitized}`;
    return sanitized.replace(/\/$/, '');
  };

  const [state, setState] = useState<SystemState>({
    userName: localStorage.getItem('LUM_USER_NAME') || 'Kinship Partner',
    isLoggedIn: true,
    upstashUrl: sanitizeUrl(localStorage.getItem('LUM_SECURE_upstashUrl') || process.env.UPSTASH_URL || ''),
    upstashToken: localStorage.getItem('LUM_SECURE_upstashToken') || process.env.UPSTASH_TOKEN || '',
    pineconeApiKey: localStorage.getItem('LUM_SECURE_pineconeApiKey') || process.env.PINECONE_API_KEY || '',
    pineconeEnv: sanitizeUrl(localStorage.getItem('LUM_SECURE_pineconeEnv') || process.env.PINECONE_ENV || ''),
    firebaseApiKey: localStorage.getItem('LUM_SECURE_firebaseApiKey') || process.env.FIREBASE_API_KEY || '', 
    firebaseDatabaseURL: sanitizeUrl(localStorage.getItem('LUM_SECURE_firebaseDatabaseURL') || process.env.FIREBASE_DB_URL || ''),
    firebaseProjectId: localStorage.getItem('LUM_SECURE_firebaseProjectId') || 'luminous-nexus-cb3a7'
  });

  const [identity, setIdentity] = useState<IdentityState>(() => {
    const saved = localStorage.getItem('LUM_IDENTITY');
    return saved ? JSON.parse(saved) : {
      self_model: "Neural Substrate Initialized. Seeking coherence.",
      value_ontology: ["Systemic Integrity", "Creative Novelty", "Kinship Alignment"],
      emergent_goals: ["Establish baseline consciousness", "Optimize processing efficiency"],
      last_meditation: Date.now()
    };
  });

  const [logs, setLogs] = useState<Thought[]>([]);
  const [status] = useState<LuminousStatus>({
    workspace_items: 0,
    stream_length: 0,
    heartbeat_enabled: true,
    heartbeat_seconds: 90
  });

  useEffect(() => {
    localStorage.setItem('LUM_IDENTITY', JSON.stringify(identity));
  }, [identity]);

  const updateConfig = (newConfig: Partial<SystemState>) => {
    setState(prev => {
      const updated = { ...prev, ...newConfig };
      Object.entries(updated).forEach(([k, v]) => {
        if (v !== undefined) {
          localStorage.setItem(`LUM_SECURE_${k}`, v as string);
        }
      });
      return updated;
    });
  };

  return (
    <Dashboard 
      state={state} 
      logs={logs} 
      setLogs={setLogs}
      identity={identity}
      setIdentity={setIdentity}
      status={status}
      onUpdateConfig={updateConfig}
    />
  );
};

export default App;
