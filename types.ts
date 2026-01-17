
export interface Thought {
  id: string;
  ts: number;
  source: string;
  content: string;
  confidence: number;
  valence: number;
  attention: number;
  metadata: {
    valuation?: Record<string, number>;
    veto?: boolean;
    note?: string;
    quantum_coherence?: number;
  };
}

export interface MemoryItem {
  id: string;
  ts: number;
  lane: 'short' | 'long' | 'narrative';
  source: string;
  content: string;
  attention: number;
  confidence: number;
  valence: number;
  meta: Record<string, any>;
}

export interface SystemState {
  userName: string;
  isLoggedIn: boolean;
  upstashUrl: string;
  upstashToken: string;
  pineconeApiKey: string;
  pineconeEnv: string;
  firebaseApiKey?: string;
  firebaseDatabaseURL?: string;
  firebaseProjectId?: string;
}

export interface LuminousStatus {
  workspace_items: number;
  stream_length: number;
  heartbeat_enabled: boolean;
  heartbeat_seconds: number;
}
