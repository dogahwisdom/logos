// Supabase Edge Function: paper analysis via Gemini API
// Set GEMINI_API_KEY in Supabase Dashboard → Project Settings → Edge Functions → Secrets

const MODEL = "gemini-2.0-flash";
const PROMPT = `You are LOGOS, a senior scientific discovery agent. 
Analyze the following research paper text.

Your task is to:
1. Summarize the "Methodology" section concisely.
2. Identify 3 critical assumptions in the methodology that might be flawed or lack sufficient evidence.
3. Perform a "Deep Reasoning" phase where you critique the experimental design, control variables, and statistical power step-by-step.
4. Propose a Python script to validate the assumption.
5. Generate a JSON dataset (list of x,y objects) that represents the *predicted* outcome of this experiment if the assumption is flawed. This data will be plotted on a chart.
6. Assign a "Reproducibility Score" (0-100).
7. Assess "Citation Integrity".

Structure your response strictly using these XML-like tags:

<summary>
[Methodology Summary]
</summary>

<metrics>
<reproducibility>[0-100]</reproducibility>
<integrity>[High/Medium/Low]</integrity>
</metrics>

<reasoning>
[Deep Reasoning]
</reasoning>

<assumptions>
- [Assumption 1]
- [Assumption 2]
- [Assumption 3]
</assumptions>

<code>
[Python Code]
</code>

<simulation_data>
[
  {"x": 0, "y": 0.1},
  {"x": 1, "y": 0.5},
  ...
]
</simulation_data>

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

function parseResponse(text: string) {
  const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
  const reasoningMatch = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const assumptionsMatch = text.match(/<assumptions>([\s\S]*?)<\/assumptions>/);
  const codeMatch = text.match(/<code>([\s\S]*?)<\/code>/);
  const reproMatch = text.match(/<reproducibility>([\s\S]*?)<\/reproducibility>/);
  const integrityMatch = text.match(/<integrity>([\s\S]*?)<\/integrity>/);
  const simMatch = text.match(/<simulation_data>([\s\S]*?)<\/simulation_data>/);

  const summary = summaryMatch ? summaryMatch[1].trim() : "Could not extract summary.";
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "Could not extract reasoning.";
  const reproducibilityScore = reproMatch ? parseInt(reproMatch[1].trim()) || 75 : 0;
  const citationIntegrity = integrityMatch ? integrityMatch[1].trim() : "Unknown";

  const assumptionsRaw = assumptionsMatch ? assumptionsMatch[1].trim() : "";
  const assumptions = assumptionsRaw
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  let experimentCode = codeMatch ? codeMatch[1].trim() : "# Could not generate code.";
  experimentCode = experimentCode.replace(/```python/g, "").replace(/```/g, "");

  let simulationData: { x: number; y: number }[] = [];
  try {
    if (simMatch) simulationData = JSON.parse(simMatch[1].trim());
  } catch {
    // ignore
  }

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

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  let body: { paperText?: string; temperature?: number };
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

  const temperature = typeof body.temperature === "number" ? body.temperature : 0.7;
  const prompt = PROMPT + paperText.slice(0, 30000);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
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
  const result = parseResponse(text);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: corsHeaders(origin),
  });
});
