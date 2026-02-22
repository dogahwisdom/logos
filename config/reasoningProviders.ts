import type { ReasoningProvider } from '../types';

export interface ProviderMeta {
  label: string;
  baseUrl: string;
  modelPlaceholder: string;
  /** Gemini uses Edge Function; others use OpenAI-compatible client. */
  useNativeGemini: boolean;
}

export const REASONING_PROVIDERS: Record<Exclude<ReasoningProvider, 'custom'>, ProviderMeta> = {
  openai: {
    label: 'OpenAI (GPT)',
    baseUrl: 'https://api.openai.com/v1',
    modelPlaceholder: 'e.g. gpt-4o, gpt-4o-mini, gpt-4-turbo',
    useNativeGemini: false,
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: '', // Not used; Edge Function
    modelPlaceholder: 'e.g. gemini-2.0-flash, gemini-1.5-pro',
    useNativeGemini: true,
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    modelPlaceholder: 'e.g. claude-sonnet-4, claude-opus-4',
    useNativeGemini: false,
  },
  k2: {
    label: 'K2 (MBZUAI)',
    baseUrl: 'https://api.k2think.ai/v1',
    modelPlaceholder: 'e.g. MBZUAI-IFM/K2-Think-v2',
    useNativeGemini: false,
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelPlaceholder: 'e.g. llama-3.1-70b-versatile, mixtral-8x7b-32768',
    useNativeGemini: false,
  },
  together: {
    label: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    modelPlaceholder: 'e.g. meta-llama/Llama-3.1-70B-Instruct-Turbo',
    useNativeGemini: false,
  },
};

export const PROVIDER_ORDER: ReasoningProvider[] = [
  'openai',
  'gemini',
  'anthropic',
  'k2',
  'groq',
  'together',
  'custom',
];

export function getBaseUrlForProvider(
  provider: ReasoningProvider,
  customBaseUrl: string
): string {
  if (provider === 'custom') return customBaseUrl.trim();
  const meta = REASONING_PROVIDERS[provider];
  return meta?.baseUrl ?? customBaseUrl.trim();
}
