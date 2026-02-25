// Supabase Edge Function: paper analysis via Gemini API
// Set GEMINI_API_KEY in Supabase Dashboard → Project Settings → Edge Functions → Secrets

const MODEL = "gemini-2.0-flash";
const PROMPT = `You are LOGOS, a strict JSON API. You must respond ONLY with a valid JSON object. Do not include <think> tags, XML tags, conversational text, or markdown formatting outside of the JSON block.
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

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

function parseResponse(rawText: string) {
  let parsed: any;
  try {
    // 1. Remove <think> tags and their contents (critical for reasoning models)
    let cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/g, '');

    // 2. Remove markdown formatting
    cleanText = cleanText.replace(/```json/gi, '').replace(/```/g, '');

    // 3. Extract the JSON object
    const startIndex = cleanText.indexOf('{');
    const endIndex = cleanText.lastIndexOf('}');

    if (startIndex !== -1 && endIndex !== -1) {
      const jsonString = cleanText.substring(startIndex, endIndex + 1);
      parsed = JSON.parse(jsonString);
    } else {
      throw new Error("No JSON brackets found in response");
    }
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    console.log("Raw Response was:", rawText);
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

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "*";
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders(origin) }
    );
  }

  let body: { paperText?: string; temperature?: number; geminiApiKey?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const paperText = body.paperText;
  if (!paperText || typeof paperText !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing or invalid paperText" }),
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const apiKey = (body.geminiApiKey && typeof body.geminiApiKey === "string" && body.geminiApiKey.trim())
    ? body.geminiApiKey.trim()
    : Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "No Gemini API key. Add your key in Settings (Gemini API) or set GEMINI_API_KEY in Edge Function secrets." }),
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const temperature = typeof body.temperature === "number" ? body.temperature : 0.7;
  const model = (body.model && typeof body.model === "string" && body.model.trim()) ? body.model.trim() : MODEL;
  const prompt = PROMPT + paperText.slice(0, 30000);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini API error:", res.status, err);
    return new Response(
      JSON.stringify({ error: "Analysis failed" }),
      { status: 502, headers: corsHeaders(origin) }
    );
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  console.log("Raw API Response:", text);

  try {
    const result = parseResponse(text);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders(origin),
    });
  } catch (error) {
    console.error("Parse error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Parse error" }), {
      status: 500,
      headers: corsHeaders(origin),
    });
  }
});
