import { AnalysisResult } from "../types";

interface CustomAIConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

/**
 * Call the user's OpenAI-compatible API directly from the browser.
 * Users add their own API in Settings (base URL, API key, model). No backend proxy.
 * The API must allow CORS from your app origin (most hosted APIs do).
 */

/** Build chat completions URL: accept either base (e.g. https://api.example.com/v1) or full path (e.g. .../v1/chat/completions). */
export function getChatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '').trim();
  if (!base) return '';
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

/** Auth headers: Anthropic uses x-api-key; others use Authorization Bearer. */
function getAuthHeaders(baseUrl: string, apiKey: string): Record<string, string> {
  const isAnthropic = /anthropic\.com/i.test(baseUrl);
  if (isAnthropic) {
    return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  }
  return { 'Authorization': `Bearer ${apiKey}` };
}

export const analyzePaperWithCustomAI = async (
  paperText: string,
  config: CustomAIConfig,
  temperature: number = 0.7
): Promise<AnalysisResult> => {

  const prompt = `
    You are LOGOS, a strict JSON API. You must respond ONLY with a valid JSON object. Do not include <think> tags, XML tags, conversational text, or markdown formatting outside of the JSON block.
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

    You must wrap your final, completed JSON object inside strict custom tags like this:
    <FINAL_JSON>
    { ... }
    </FINAL_JSON>
    Do not put any other text inside these tags.

    Paper Text:
    ${paperText.slice(0, 30000)} 
  `;

  try {
    const url = getChatCompletionsUrl(config.baseUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(config.baseUrl, config.apiKey),
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: "system", content: "You are a helpful scientific assistant." },
          { role: "user", content: prompt }
        ],
        temperature
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Custom API Error: ${response.statusText} - ${errorData.error || ''}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    console.log("Raw API Response:", text);


    let parsed: any;
    try {
      // Look for the custom tags we instructed the LLM to use
      const startTag = "<FINAL_JSON>";
      const endTag = "</FINAL_JSON>";

      const startIndex = text.indexOf(startTag);
      const endIndex = text.indexOf(endTag);

      if (startIndex !== -1 && endIndex !== -1) {
        // Extract everything between the tags
        let jsonString = text.substring(startIndex + startTag.length, endIndex).trim();

        // Safety check: strip markdown if it snuck inside the tags
        jsonString = jsonString.replace(/```json/gi, '').replace(/```/g, '').trim();

        parsed = JSON.parse(jsonString);
      } else {
        // Fallback if the model forgot the tags (regex for the largest JSON block)
        const jsonBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
          parsed = JSON.parse(jsonBlockMatch[1]);
        } else {
          throw new Error("Could not find <FINAL_JSON> tags or valid markdown block");
        }
      }
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      console.log("Raw Response snippet:", text.substring(0, 500) + "...");
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
      citationIntegrity
    };

  } catch (error) {
    console.error("Custom AI Analysis Error:", error);
    throw new Error("Failed to analyze with Custom AI. Please check your settings.");
  }
};
