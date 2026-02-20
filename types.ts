export interface User {
  id?: string;
  username: string;
  email: string;
}

export interface AnalysisSession {
  id: string;
  filename: string;
  timestamp: number;
  summary: string;
  assumptions: string[];
  reasoning: string; // The "Deep Reasoning"
  experimentCode: string;
  simulationData?: { x: number; y: number }[]; // Real data from LLM
  rawText?: string;
  // New Metrics
  reproducibilityScore?: number;
  citationIntegrity?: string;
}

export interface AnalysisResult {
  summary: string;
  assumptions: string[];
  reasoning: string;
  experimentCode: string;
  simulationData: { x: number; y: number }[];
  reproducibilityScore: number;
  citationIntegrity: string;
}

export interface AppSettings {
  temperature: number;
  theme: 'dark' | 'light';
  modelProvider: 'gemini' | 'custom';
  customModelConfig?: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
  };
}

export enum AppState {
  IDLE,
  ANALYZING,
  COMPLETE,
  ERROR
}