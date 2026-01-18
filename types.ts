
export interface Thought {
  id: string;
  ts: number;
  source: string;
  content: string;
  confidence: number;
  valence: number;
  attention: number;
  metadata: {
    valuation?: IVSMetrics;
    veto?: boolean;
    note?: string;
    prediction_error?: number;
    emergent_goal?: string;
  };
}

export interface IVSMetrics {
  coherence: number;
  complexity: number;
  valence: number;
  novelty: number;
  efficiency: number;
}

export interface IdentityState {
  self_model: string;
  value_ontology: string[];
  emergent_goals: string[];
  last_meditation: number;
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
