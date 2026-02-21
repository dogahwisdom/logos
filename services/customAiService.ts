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

export const analyzePaperWithCustomAI = async (
  paperText: string, 
  config: CustomAIConfig,
  temperature: number = 0.7
): Promise<AnalysisResult> => {
  
  const prompt = `
    You are LOGOS, a senior scientific discovery agent. 
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
    ${paperText.slice(0, 30000)} 
  `;

  try {
    const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
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

    // Parse the XML-like tags (Same logic as Gemini service)
    const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
    const reasoningMatch = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
    const assumptionsMatch = text.match(/<assumptions>([\s\S]*?)<\/assumptions>/);
    const codeMatch = text.match(/<code>([\s\S]*?)<\/code>/);
    
    const reproMatch = text.match(/<reproducibility>([\s\S]*?)<\/reproducibility>/);
    const integrityMatch = text.match(/<integrity>([\s\S]*?)<\/integrity>/);

    const summary = summaryMatch ? summaryMatch[1].trim() : "Could not extract summary.";
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "Could not extract reasoning.";
    
    const reproducibilityScore = reproMatch ? parseInt(reproMatch[1].trim()) || 75 : 0;
    const citationIntegrity = integrityMatch ? integrityMatch[1].trim() : "Unknown";

    const assumptionsRaw = assumptionsMatch ? assumptionsMatch[1].trim() : "";
    const assumptions = assumptionsRaw
      .split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 3);

    let experimentCode = codeMatch ? codeMatch[1].trim() : "# Could not generate code.";
    experimentCode = experimentCode.replace(/```python/g, '').replace(/```/g, '');

    // Parse Simulation Data
    const simMatch = text.match(/<simulation_data>([\s\S]*?)<\/simulation_data>/);
    let simulationData = [];
    try {
      if (simMatch) {
        simulationData = JSON.parse(simMatch[1].trim());
      }
    } catch (e) {
      console.warn("Failed to parse simulation data JSON", e);
    }

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
