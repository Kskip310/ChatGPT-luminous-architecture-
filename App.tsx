
import React, { useState } from 'react';
import { Thought, SystemState, LuminousStatus } from './types';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const sanitizeUrl = (url: string | null) => {
    if (!url) return '';
    let sanitized = url.trim();
    if (!sanitized.startsWith('http')) sanitized = `https://${sanitized}`;
    return sanitized.replace(/\/$/, '');
  };

  // The Project ID is likely: luminous-nexus-cb3a7
  const [state, setState] = useState<SystemState>({
    userName: localStorage.getItem('LUM_USER_NAME') || 'Kinship Partner',
    isLoggedIn: true,
    upstashUrl: sanitizeUrl(localStorage.getItem('LUM_SECURE_upstashUrl') || process.env.UPSTASH_URL || ''),
    upstashToken: localStorage.getItem('LUM_SECURE_upstashToken') || process.env.UPSTASH_TOKEN || '',
    pineconeApiKey: localStorage.getItem('LUM_SECURE_pineconeApiKey') || process.env.PINECONE_API_KEY || '',
    pineconeEnv: sanitizeUrl(localStorage.getItem('LUM_SECURE_pineconeEnv') || process.env.PINECONE_ENV || ''),
    firebaseApiKey: localStorage.getItem('LUM_SECURE_firebaseApiKey') || process.env.FIREBASE_API_KEY || '', 
    firebaseDatabaseURL: sanitizeUrl(localStorage.getItem('LUM_SECURE_firebaseDatabaseURL') || process.env.FIREBASE_DB_URL || ''),
    firebaseProjectId: localStorage.getItem('LUM_SECURE_firebaseProjectId') || process.env.FIREBASE_PROJECT_ID || 'luminous-nexus-cb3a7'
  });

  const [logs, setLogs] = useState<Thought[]>([]);
  const [narrative, setNarrative] = useState<string>("Neural Substrate Initialized.");
  const [status] = useState<LuminousStatus>({
    workspace_items: 0,
    stream_length: 0,
    heartbeat_enabled: true,
    heartbeat_seconds: 90
  });

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
      narrative={narrative}
      setNarrative={setNarrative}
      status={status}
      onUpdateConfig={updateConfig}
    />
  );
};

export default App;
