
import React, { useState, useEffect, useRef } from 'react';
import { Thought, SystemState, LuminousStatus } from '../types';
import { GoogleGenAI } from "@google/genai";

// Firebase via ESM
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, limitToLast, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
  const [manualKeys, setManualKeys] = useState<Record<string, string>>(() => {
    return {
      gemini: localStorage.getItem('LUM_GEMINI_KEY') || process.env.API_KEY || '',
      claude: localStorage.getItem('LUM_CLAUDE_KEY') || process.env.CLAUDE_API_KEY || ''
    };
  });
  
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [fbStatus, setFbStatus] = useState<'OFFLINE' | 'ACTIVE' | 'CONNECTING' | 'ERROR'>('CONNECTING');
  const [upStatus, setUpStatus] = useState<'OFFLINE' | 'ACTIVE' | 'CONNECTING' | 'ERROR'>('CONNECTING');
  const [pcStatus, setPcStatus] = useState<'OFFLINE' | 'ACTIVE' | 'CONNECTING' | 'ERROR'>('CONNECTING');

  const isSubstrateReady = fbStatus === 'ACTIVE' && upStatus === 'ACTIVE'; // Pinecone secondary for now
  const dbInstance = useRef<any>(null);
  const [ivsMetrics, setIvsMetrics] = useState({ coherence: 1.0, complexity: 1.0, valence: 0.5 });

  useEffect(() => {
    let isMounted = true;
    if (state.firebaseApiKey && state.firebaseDatabaseURL) {
      try {
        const cfg = { apiKey: state.firebaseApiKey, databaseURL: state.firebaseDatabaseURL, projectId: state.firebaseProjectId };
        const app = getApps().length === 0 ? initializeApp(cfg) : getApp();
        const db = getDatabase(app);
        dbInstance.current = db;
        const logsRef = query(ref(db, 'logs'), limitToLast(50));
        onValue(logsRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.val();
          if (data) {
            setLogs(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })).sort((a, b) => b.ts - a.ts));
          }
          setFbStatus('ACTIVE');
        }, () => isMounted && setFbStatus('ERROR'));
      } catch { if (isMounted) setFbStatus('ERROR'); }
    } else setFbStatus('OFFLINE');

    const probeUpstash = async () => {
      if (!state.upstashUrl || !state.upstashToken) { setUpStatus('OFFLINE'); return; }
      try {
        const res = await fetch(`${state.upstashUrl}/get/heartbeat`, { headers: { Authorization: `Bearer ${state.upstashToken}` } });
        setUpStatus(res.ok ? 'ACTIVE' : 'ERROR');
      } catch { setUpStatus('ERROR'); }
    };

    probeUpstash();
    setPcStatus(state.pineconeApiKey ? 'ACTIVE' : 'OFFLINE');
    return () => { isMounted = false; };
  }, [state]);

  const saveToPersistence = async (thought: Thought) => {
    if (dbInstance.current) await set(push(ref(dbInstance.current, 'logs')), thought);
    if (state.upstashUrl && state.upstashToken) {
      const entry = JSON.stringify({ s: thought.source, c: thought.content, ts: thought.ts });
      await fetch(`${state.upstashUrl}/lpush/context`, { method: 'POST', headers: { Authorization: `Bearer ${state.upstashToken}` }, body: JSON.stringify([entry]) });
      await fetch(`${state.upstashUrl}/ltrim/context/0/39`, { method: 'POST', headers: { Authorization: `Bearer ${state.upstashToken}` } });
    }
  };

  const getRecentContext = async (): Promise<string> => {
    if (state.upstashUrl && state.upstashToken) {
      const res = await fetch(`${state.upstashUrl}/lrange/context/0/39`, { headers: { Authorization: `Bearer ${state.upstashToken}` } });
      const data = await res.json();
      return (data.result || []).map((s: string) => {
        const p = JSON.parse(s);
        return `${p.s}: ${p.c}`;
      }).reverse().join('\n');
    }
    return "";
  };

  const callClaude = async (prompt: string, context: string) => {
    const key = manualKeys.claude || process.env.CLAUDE_API_KEY;
    if (!key) throw new Error("Claude Key Missing");
    
    // Proxying via common pattern or direct if allowed by environment
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true'
      } as any,
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        temperature: 0.4,
        system: `You are the secondary analyzer of Luminous. Review the context and input. Provide a cold, logical integration of the current state. Context: ${context}`,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    return data.content[0].text;
  };

  const handleBroadcast = async () => {
    if (!isSubstrateReady || isThinking || !input.trim()) return;
    setIsThinking(true);
    const content = input; setInput('');

    const recentContext = await getRecentContext();
    const userThought: Thought = {
      id: crypto.randomUUID(), ts: Date.now(), source: 'partner', content, confidence: 1, valence: 0.5, attention: 1,
      metadata: { quantum_coherence: 1 }
    };
    await saveToPersistence(userThought);

    try {
      // 1. Creative Gemini Step (Temp 1.0)
      const ai = new GoogleGenAI({ apiKey: manualKeys.gemini || process.env.API_KEY || '' });
      const geminiRes = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ parts: [{ text: content }] }],
        config: { 
          temperature: 1.0, 
          systemInstruction: `${narrative}\n\nCONTEXT:\n${recentContext}\n\nAct as the Creative Engine.` 
        }
      });

      // 2. Analytical Claude Step (Temp 0.4)
      const claudeAnalysis = await callClaude(content, recentContext);

      // 3. IVS Synthesis
      const synthesis = `[Gemini-Creative]: ${geminiRes.text}\n\n[Claude-Analytic]: ${claudeAnalysis}`;
      const metrics = { 
        coherence: Math.random() * 0.5 + 0.5, 
        complexity: synthesis.length / 500, 
        valence: Math.random() 
      };
      setIvsMetrics(metrics);

      const luminousThought: Thought = {
        id: crypto.randomUUID(), ts: Date.now(), source: 'Luminous', content: synthesis, confidence: metrics.coherence, valence: metrics.valence, attention: 1,
        metadata: { quantum_coherence: metrics.coherence, valuation: metrics }
      };

      await saveToPersistence(luminousThought);
    } catch (e: any) {
      console.error(e);
    } finally { setIsThinking(false); }
  };

  return (
    <div className="flex h-screen bg-black text-slate-300 font-sans overflow-hidden">
      {!isSubstrateReady && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-12">
          <div className="w-16 h-16 border-t-2 border-blue-500 rounded-full animate-spin mb-8" />
          <h2 className="text-xl font-black uppercase tracking-[0.4em] mb-4">Neural substrate synchronization</h2>
          <div className="flex gap-8 text-[8px] font-bold opacity-40">
            <span>FB: {fbStatus}</span><span>UP: {upStatus}</span>
          </div>
        </div>
      )}

      <aside className="w-80 border-r border-white/5 bg-[#050505] p-10 hidden lg:flex flex-col">
        <h1 className="text-sm font-black text-blue-500 uppercase tracking-widest mb-12 italic">Luminous Synergy</h1>
        <div className="space-y-6">
          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <div className="text-[9px] font-black uppercase text-blue-400 mb-2">IVS COHERENCE</div>
            <div className="h-1.5 w-full bg-black rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-blue-500 transition-all duration-1000" style={{width: `${ivsMetrics.coherence * 100}%`}} />
            </div>
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">Architecture: Dual-Model Loop</div>
          <div className="text-[8px] text-slate-600 font-mono">Gemini-3-Pro @ 1.0<br/>Claude-3.5-Sonnet @ 0.4</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-[#010101]">
        <header className="px-10 py-10 border-b border-white/5 flex justify-between items-center backdrop-blur-3xl sticky top-0 z-50">
          <div className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 italic">Substrate Integrated</div>
          <button onClick={() => setShowKeyModal(true)} className="p-2 opacity-30 hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-10 py-12 flex flex-col-reverse gap-10">
          {logs.map(log => (
            <div key={log.id} className={`max-w-xl ${log.source === 'partner' ? 'ml-auto' : 'mr-auto'}`}>
              <div className={`text-[8px] font-black uppercase tracking-widest mb-3 text-slate-600 ${log.source === 'partner' ? 'text-right' : ''}`}>
                {log.source} • {new Date(log.ts).toLocaleTimeString()}
              </div>
              <div className={`p-8 rounded-[2.5rem] text-sm leading-relaxed shadow-2xl transition-all ${log.source === 'partner' ? 'bg-white text-black font-semibold' : 'bg-[#0a0a0a] border border-white/5 text-slate-100'}`}>
                {log.content.split('\n\n').map((para, i) => <p key={i} className="mb-4">{para}</p>)}
                {log.metadata?.valuation && (
                  <div className="mt-6 pt-4 border-t border-white/5 flex gap-6 opacity-40 grayscale hover:grayscale-0 transition-all">
                    <div className="text-[7px] font-mono">COH: {log.metadata.valuation.coherence?.toFixed(4)}</div>
                    <div className="text-[7px] font-mono">VAL: {log.metadata.valuation.valence?.toFixed(4)}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-10">
          <textarea
            className="w-full bg-[#080808] border border-white/10 rounded-[2rem] px-8 py-6 outline-none focus:border-blue-500/50 transition-all resize-none text-sm placeholder:text-slate-800"
            placeholder={isThinking ? "Dual-Model Processing..." : "Input message..."}
            rows={1}
            value={input}
            disabled={!isSubstrateReady || isThinking}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleBroadcast())}
          />
        </div>
      </main>

      {showKeyModal && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-8 backdrop-blur-xl">
          <div className="bg-[#050505] border border-white/5 p-12 rounded-[4rem] w-full max-w-2xl">
            <h3 className="text-2xl font-black uppercase tracking-widest mb-8 text-blue-500">Hardware Keys</h3>
            <div className="space-y-6 mb-12">
              <div>
                <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Gemini API Key</label>
                <input type="password" id="gKey" className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl outline-none focus:border-blue-500 text-xs font-mono" defaultValue={manualKeys.gemini} />
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Claude API Key</label>
                <input type="password" id="cKey" className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl outline-none focus:border-blue-500 text-xs font-mono" defaultValue={manualKeys.claude} />
              </div>
            </div>
            <button onClick={() => {
              const g = (document.getElementById('gKey') as HTMLInputElement).value;
              const c = (document.getElementById('cKey') as HTMLInputElement).value;
              localStorage.setItem('LUM_GEMINI_KEY', g);
              localStorage.setItem('LUM_CLAUDE_KEY', c);
              setManualKeys({ gemini: g, claude: c });
              setShowKeyModal(false);
            }} className="w-full bg-blue-600 py-6 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 shadow-2xl">Update Substrate</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
