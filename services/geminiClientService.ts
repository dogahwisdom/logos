import type { AnalysisResult } from '../types';

const LOGOS_PROMPT = `You are LOGOS, a strict JSON API. You must respond ONLY with a valid JSON object. Do not include <think> tags, XML tags, conversational text, or markdown formatting outside of the JSON block.
Analyze the following research paper text.

Your task is to:
1. Summarize the "Methodology" section concisely.
2. Identify 3 critical assumptions in the methodology that might be flawed or lack sufficient evidence.
3. Perform a "Deep Reasoning" phase where you critique the experimental design, control variables, and statistical power step-by-step.
4. Propose a Python script to validate the assumption.
5. Generate a JSON dataset (list of x,y objects) that represents the *predicted* outcome of this experiment if the assumption is flawed. This data will be plotted on a chart. NEVER use ellipses (...) or placeholders in arrays. Generate the full, complete dataset.
6. Assign a "Reproducibility Score" (0-100).
7. Assess "Citation Integrity".

You must return exactly this JSON schema:
{
  "methodology_summary": "string",
  "deep_reasoning": "string",
  "critical_assumptions": ["string", "string", "string"],
  "reproducibility_score": number,
  "citation_integrity": "string",
  "simulation_python_code": "string",
  "simulation_data": [{"x": number, "y": number}]
}

Paper Text:
`;

function parseGeminiResponse(rawText: string): AnalysisResult {
  const text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '');

  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
  }

  const startIdx = jsonStr.indexOf('{');
  const endIdx = jsonStr.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("Failed to parse analysis JSON. The model generated invalid JSON.");
  }

  const summary = parsed.methodology_summary || 'Could not extract summary.';
  const reasoning = parsed.deep_reasoning || 'Could not extract reasoning.';
  const reproducibilityScore = typeof parsed.reproducibility_score === 'number' ? parsed.reproducibility_score : 75;
  const citationIntegrity = parsed.citation_integrity || 'Unknown';

  const assumptions = Array.isArray(parsed.critical_assumptions)
    ? parsed.critical_assumptions.slice(0, 3)
    : [];

  let experimentCode = parsed.simulation_python_code || '# Could not generate code.';
  experimentCode = experimentCode.replace(/```python/g, '').replace(/```/g, '');

  const simulationData = Array.isArray(parsed.simulation_data) ? parsed.simulation_data : [];

  return {
    summary,
    reasoning,
    assumptions,
    experimentCode,
    simulationData,
    reproducibilityScore,
    citationIntegrity,
  };
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Call Google Gemini API directly from the client (no Edge Function).
 * Uses the same prompt and response parsing as other providers.
 */
export async function analyzePaperWithGemini(
  paperText: string,
  apiKey: string,
  modelName: string,
  temperature: number = 0.7
): Promise<AnalysisResult> {
  const key = apiKey.trim();
  const model = modelName.trim() || 'gemini-2.0-flash';
  if (!key) {
    throw new Error('Gemini API key is required. Add it in Settings → Reasoning Engine → Google Gemini.');
  }

  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const prompt = LOGOS_PROMPT + paperText.slice(0, 30000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature },
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      throw new Error(
        'Could not reach Gemini from the browser (network or CORS). Try again or use a VPN; if the issue persists, use Custom API with an OpenAI-compatible Gemini endpoint.'
      );
    }
    throw e;
  }

  if (!res.ok) {
    const errText = await res.text();
    let msg = `Gemini API error (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      const detail = errJson?.error?.message ?? errJson?.message ?? errText?.slice(0, 200);
      if (detail) msg = detail;
    } catch {
      if (errText) msg = errText.slice(0, 300);
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  console.log("Raw API Response:", text);

  if (!text) {
    throw new Error('No response text from Gemini. The model may have blocked the output.');
  }
  return parseGeminiResponse(text);
}

/**
 * Test Gemini connection (minimal generateContent call). No Edge Function.
 */
export async function testGeminiConnection(apiKey: string, modelName: string): Promise<void> {
  const key = apiKey.trim();
  const model = modelName.trim() || 'gemini-2.0-flash';
  if (!key) {
    throw new Error('Enter your Gemini API key.');
  }

  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10 },
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      throw new Error(
        'Could not reach Gemini (network or CORS). Check your connection and that the API key is valid.'
      );
    }
    throw e;
  }

  if (!res.ok) {
    const errText = await res.text();
    let msg = `Connection failed (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      const detail = errJson?.error?.message ?? errJson?.message;
      if (detail) msg = detail;
    } catch {
      if (errText) msg = errText.slice(0, 200);
    }
    throw new Error(msg);
  }
}
