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

/** Reasoning engine provider. Gemini uses native API; others use OpenAI-compatible chat completions. */
export type ReasoningProvider =
  | 'openai'   // GPT-4, etc.
  | 'gemini'   // Google Gemini
  | 'anthropic' // Claude
  | 'k2'       // MBZUAI K2
  | 'groq'     // Groq (Llama, Mixtral, etc.)
  | 'together' // Together (open models)
  | 'custom';  // Any OpenAI-compatible endpoint

export interface AppSettings {
  temperature: number;
  theme: 'dark' | 'light';
  reasoningProvider: ReasoningProvider;
  providerConfigs: Record<ReasoningProvider, {
    baseUrl: string;
    apiKey: string;
    modelName: string;
  }>;
  /** @deprecated Migrated to providerConfigs */
  reasoningConfig?: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
  };
  /** @deprecated Migrated to reasoningProvider + reasoningConfig */
  modelProvider?: 'gemini' | 'custom';
  customModelConfig?: { baseUrl: string; apiKey: string; modelName: string };
  geminiConfig?: { apiKey: string; modelName: string };
}

export enum AppState {
  IDLE,
  ANALYZING,
  COMPLETE,
  ERROR
}