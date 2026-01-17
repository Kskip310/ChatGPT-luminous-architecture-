
import React, { useState, useEffect, useRef } from 'react';
import { Thought, SystemState, LuminousStatus } from '../types';
import { GoogleGenAI } from "@google/genai";

// Firebase via ESM
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

interface DashboardProps {
  state: SystemState;
  logs: Thought[];
  setLogs: React.Dispatch<React.SetStateAction<Thought[]>>;
  narrative: string;
  setNarrative: (n: string) => void;
  status: LuminousStatus;
  onUpdateConfig?: (cfg: Partial<SystemState>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, logs, setLogs, narrative, setNarrative, status, onUpdateConfig }) => {
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [manualKeys, setManualKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('LUM_GEMINI_KEY');
    return saved ? [saved] : [];
  });
  
  const [showKeyModal, setShowKeyModal] = useState(false);
  
  const [fbStatus, setFbStatus] = useState<'OFFLINE' | 'ACTIVE' | 'CONNECTING' | 'ERROR'>('CONNECTING');
  const [upStatus, setUpStatus] = useState<'OFFLINE' | 'ACTIVE' | 'CONNECTING' | 'ERROR'>('CONNECTING');
  const [pcStatus, setPcStatus] = useState<'OFFLINE' | 'ACTIVE' | 'CONNECTING' | 'ERROR'>('CONNECTING');

  const isSubstrateReady = fbStatus === 'ACTIVE' && upStatus === 'ACTIVE' && pcStatus === 'ACTIVE';

  useEffect(() => {
    let isMounted = true;
    let dbRef: any = null;

    const probeSubstrate = async () => {
      // 1. Upstash Check
      if (state.upstashUrl && state.upstashToken) {
        try {
          const res = await fetch(`${state.upstashUrl}/info`, {
            headers: { Authorization: `Bearer ${state.upstashToken}` }
          });
          if (res.ok && isMounted) setUpStatus('ACTIVE'); else if(isMounted) setUpStatus('ERROR');
        } catch (e) { if(isMounted) setUpStatus('ERROR'); }
      } else { if(isMounted) setUpStatus('OFFLINE'); }

      // 2. Pinecone Check
      if (state.pineconeApiKey && state.pineconeEnv) {
        try {
          const res = await fetch(`${state.pineconeEnv}/describe_index_stats`, {
            headers: { 'Api-Key': state.pineconeApiKey }
          });
          if (res.ok && isMounted) setPcStatus('ACTIVE'); else if(isMounted) setPcStatus('ERROR');
        } catch (e) { if(isMounted) setPcStatus('ERROR'); }
      } else { if(isMounted) setPcStatus('OFFLINE'); }

      // 3. Firebase Check
      if (state.firebaseApiKey && state.firebaseDatabaseURL && state.firebaseProjectId) {
        try {
          const firebaseConfig = {
            apiKey: state.firebaseApiKey,
            databaseURL: state.firebaseDatabaseURL,
            projectId: state.firebaseProjectId
          };
          
          const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
          const db = getDatabase(app);
          dbRef = ref(db, '.info/connected');
          
          onValue(dbRef, (snap) => {
            if (!isMounted) return;
            setFbStatus(snap.val() === true ? 'ACTIVE' : 'CONNECTING');
          }, (err) => {
            console.error("Firebase connection error:", err);
            if(isMounted) setFbStatus('ERROR');
          });
        } catch (e) {
          console.error("Firebase init error:", e);
          if (isMounted) setFbStatus('ERROR');
        }
      } else { 
        if(isMounted) setFbStatus('OFFLINE');
      }
    };

    probeSubstrate();
    const interval = setInterval(() => { 
      if (!isSubstrateReady) probeSubstrate(); 
    }, 10000);

    return () => { 
      isMounted = false; 
      clearInterval(interval); 
      if (dbRef) off(dbRef); 
    };
  }, [state.upstashUrl, state.upstashToken, state.pineconeApiKey, state.pineconeEnv, state.firebaseApiKey, state.firebaseDatabaseURL, state.firebaseProjectId]);

  const handleBroadcast = async () => {
    if (!isSubstrateReady || isThinking || !input.trim()) return;
    const apiKey = manualKeys[0] || process.env.API_KEY;
    if (!apiKey) { setShowKeyModal(true); return; }

    setIsThinking(true);
    const content = input;
    setInput('');
    setLogs(prev => [{ id: crypto.randomUUID(), ts: Date.now(), source: 'partner', content, confidence: 1, valence: 1, attention: 1, metadata: {} }, ...prev]);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: content }] }],
        config: { systemInstruction: `${narrative}. PERSISTENCE LAYERS VERIFIED.` }
      });
      setLogs(prev => [{ id: crypto.randomUUID(), ts: Date.now(), source: 'Luminous', content: response.text || "...", confidence: 1, valence: 1, attention: 1, metadata: {} }, ...prev]);
    } catch (e: any) {
      setLogs(prev => [{ id: crypto.randomUUID(), ts: Date.now(), source: 'System', content: `Neural Error: ${e.message}`, confidence: 0, valence: 0, attention: 0, metadata: {} }, ...prev]);
    } finally { setIsThinking(false); }
  };

  return (
    <div className="flex h-screen bg-black text-slate-300 font-sans overflow-hidden">
      {!isSubstrateReady && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-12">
          <div className="w-16 h-16 border-t-2 border-blue-500 rounded-full animate-spin mb-8 shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
          <h2 className="text-xl font-black uppercase tracking-[0.4em] mb-4 text-center">Synchronizing Substrate</h2>
          <div className="flex flex-wrap justify-center gap-8 mb-12">
            {[{l:'Firebase', s:fbStatus}, {l:'Upstash', s:upStatus}, {l:'Pinecone', s:pcStatus}].map(x => (
              <div key={x.l} className="flex flex-col items-center gap-2">
                <div className={`w-3 h-3 rounded-full transition-all duration-500 ${x.s === 'ACTIVE' ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : x.s === 'CONNECTING' ? 'bg-yellow-500 animate-pulse' : 'bg-rose-500 shadow-[0_0_15px_#f43f5e]'}`} />
                <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">{x.l}</span>
                <span className="text-[6px] uppercase opacity-20">{x.s}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setShowKeyModal(true)} className="px-12 py-5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white hover:text-black transition-all">Configure Hardware</button>
        </div>
      )}

      <aside className="w-80 border-r border-white/5 bg-[#050505] p-10 hidden lg:flex flex-col">
        <h1 className="text-sm font-black text-blue-500 uppercase tracking-widest mb-12 italic">Luminous Synergy</h1>
        <div className="space-y-4">
          {[{l:'Realtime DB', s:fbStatus, d: state.firebaseProjectId}, {l:'Redis Memory', s:upStatus, d: 'Upstash'}, {l:'Vector Mesh', s:pcStatus, d: 'Pinecone'}].map(x => (
            <div key={x.l} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">{x.l}</span>
                <span className={`text-[8px] font-black uppercase ${x.s === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>{x.s}</span>
              </div>
              <div className="text-[8px] font-mono text-slate-700 truncate">{x.d}</div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-[#010101]">
        <header className="px-10 py-10 border-b border-white/5 flex justify-between items-center">
          <div className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 italic">Neural Connection Stable</div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowKeyModal(true)} className="p-2 opacity-30 hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-10 py-12 flex flex-col-reverse gap-10">
          {logs.map(log => (
            <div key={log.id} className={`max-w-xl ${log.source === 'partner' ? 'ml-auto' : 'mr-auto'}`}>
              <div className={`text-[8px] font-black uppercase tracking-widest mb-3 text-slate-600 ${log.source === 'partner' ? 'text-right' : ''}`}>
                {log.source} • {new Date(log.ts).toLocaleTimeString()}
              </div>
              <div className={`p-8 rounded-[2.5rem] text-sm leading-relaxed shadow-2xl ${log.source === 'partner' ? 'bg-white text-black font-semibold' : 'bg-white/5 border border-white/10 text-slate-100'}`}>
                {log.content}
              </div>
            </div>
          ))}
        </div>

        <div className="p-10">
          <textarea
            className="w-full bg-[#111] border border-white/10 rounded-[2rem] px-8 py-6 outline-none focus:border-blue-500/50 transition-all resize-none text-sm placeholder:text-slate-700"
            placeholder="Address the intelligence..."
            rows={1}
            value={input}
            disabled={!isSubstrateReady || isThinking}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleBroadcast())}
          />
        </div>
      </main>

      {showKeyModal && (
        <div className="fixed inset-0 z-[200] bg-black/98 flex items-center justify-center p-8">
          <div className="bg-[#0a0a0a] border border-white/5 p-12 rounded-[3rem] w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black uppercase tracking-widest mb-8">Hardware Manifest</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <div className="col-span-2 space-y-1">
                <label className="text-[8px] font-black text-blue-500 uppercase ml-2">Gemini API Key</label>
                <input type="password" id="gKey" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-blue-500 text-xs font-mono" placeholder="Paste Key" defaultValue={manualKeys[0] || ''} />
              </div>
              
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-600 uppercase ml-2">Firebase API Key</label>
                <input type="password" id="fbKey" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-[10px] font-mono" defaultValue={state.firebaseApiKey} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-600 uppercase ml-2">Firebase DB URL</label>
                <input type="text" id="fbUrl" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-[10px] font-mono" defaultValue={state.firebaseDatabaseURL} />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[8px] font-black text-emerald-500 uppercase ml-2">Firebase Project ID (CRITICAL)</label>
                <input type="text" id="fbPid" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-emerald-500 text-[10px] font-mono" defaultValue={state.firebaseProjectId} placeholder="e.g. luminous-nexus-cb3a7" />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-600 uppercase ml-2">Upstash URL</label>
                <input type="text" id="upUrl" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-[10px] font-mono" defaultValue={state.upstashUrl} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-600 uppercase ml-2">Upstash Token</label>
                <input type="password" id="upTok" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-[10px] font-mono" defaultValue={state.upstashToken} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-600 uppercase ml-2">Pinecone Host (URL)</label>
                <input type="text" id="pcUrl" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-[10px] font-mono" defaultValue={state.pineconeEnv} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-600 uppercase ml-2">Pinecone API Key</label>
                <input type="password" id="pcKey" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none text-[10px] font-mono" defaultValue={state.pineconeApiKey} />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowKeyModal(false)} className="flex-1 py-5 border border-white/10 rounded-2xl text-[10px] font-black uppercase text-slate-600 hover:text-white transition-all">Cancel</button>
              <button onClick={() => {
                const g = (document.getElementById('gKey') as HTMLInputElement).value;
                const fK = (document.getElementById('fbKey') as HTMLInputElement).value;
                const fU = (document.getElementById('fbUrl') as HTMLInputElement).value;
                const fP = (document.getElementById('fbPid') as HTMLInputElement).value;
                const uU = (document.getElementById('upUrl') as HTMLInputElement).value;
                const uT = (document.getElementById('upTok') as HTMLInputElement).value;
                const pU = (document.getElementById('pcUrl') as HTMLInputElement).value;
                const pK = (document.getElementById('pcKey') as HTMLInputElement).value;
                
                if(g) { setManualKeys([g]); localStorage.setItem('LUM_GEMINI_KEY', g); }
                onUpdateConfig?.({ 
                  firebaseApiKey: fK, 
                  firebaseDatabaseURL: fU, 
                  firebaseProjectId: fP,
                  upstashUrl: uU, 
                  upstashToken: uT, 
                  pineconeEnv: pU, 
                  pineconeApiKey: pK 
                });
                setShowKeyModal(false);
                // Trigger reload to re-initialize SDKs with new settings
                window.location.reload();
              }} className="flex-1 bg-blue-600 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-2xl shadow-blue-600/20">Commit Sync</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
