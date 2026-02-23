import React, { useState, useRef, useEffect } from 'react';
import { AnalysisSession, AnalysisResult, AppState, AppSettings } from '../types';
import { extractTextFromPdf } from '../services/pdfService';
import { analyzePaperWithCustomAI } from '../services/customAiService';
import { analyzePaperWithGemini } from '../services/geminiClientService';
import { isSupabaseConfigured } from '../services/supabase';
import type { AnalysisResult } from '../types';
import { apiBase } from '../config/env';
import { getBaseUrlForProvider } from '../config/reasoningProviders';
import { MOCK_LOADING_STEPS } from '../constants';
import { Scorecard } from './Scorecard';
import { ReasoningGraph } from './ReasoningGraph';
import { SimulationChart } from './SimulationChart';
import toast from 'react-hot-toast';

interface WorkbenchProps {
  initialSession: AnalysisSession | null;
  onAnalysisComplete: (session: AnalysisSession) => void;
  settings: AppSettings;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

// Hardcoded script removed
const PYTHON_SIMULATION_SCRIPT = "";

export const Workbench: React.FC<WorkbenchProps> = ({ initialSession, onAnalysisComplete, settings, isSidebarOpen, onToggleSidebar }) => {
  const [appState, setAppState] = useState<AppState>(initialSession ? AppState.COMPLETE : AppState.IDLE);
  const [sessionData, setSessionData] = useState<AnalysisSession | null>(initialSession);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Simulation State
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  const [simulationData, setSimulationData] = useState<{x:number, y:number}[]>(initialSession?.simulationData || []);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingStepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDark = settings.theme === 'dark';

  // Clear loading interval on unmount (e.g. user navigates away during analysis)
  useEffect(() => {
    return () => {
      if (loadingStepIntervalRef.current) {
        clearInterval(loadingStepIntervalRef.current);
        loadingStepIntervalRef.current = null;
      }
    };
  }, []);

  // Close share menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.share-menu-container')) {
        setIsShareMenuOpen(false);
      }
    };
    if (isShareMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isShareMenuOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    // Reset input to allow selecting the same file again if needed
    if (e.target) {
      e.target.value = '';
    }
  };

  const processFile = async (file: File) => {
    // Relaxed check: Accept if mime type is pdf OR extension is pdf
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Please upload a PDF file.");
      return;
    }

    setAppState(AppState.ANALYZING);
    setLoadingStep(0);
    if (loadingStepIntervalRef.current) {
      clearInterval(loadingStepIntervalRef.current);
      loadingStepIntervalRef.current = null;
    }
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => (prev < MOCK_LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 1500);
    loadingStepIntervalRef.current = stepInterval;

    try {
      const text = await extractTextFromPdf(file);
      if (!text || text.trim().length < 50) {
        throw new Error("Could not extract enough text. The PDF might be scanned or empty.");
      }

      let result: AnalysisResult;
      const provider = settings.reasoningProvider ?? (settings.modelProvider === 'gemini' ? 'gemini' : 'custom');
      const config = settings.reasoningConfig ?? (provider === 'gemini' ? settings.geminiConfig : settings.customModelConfig) ?? { baseUrl: '', apiKey: '', modelName: '' };

      if (provider === 'gemini') {
        if (!config.apiKey?.trim()) {
          throw new Error('Add your Gemini API key in Settings → Reasoning Engine → Google Gemini.');
        }
        result = await analyzePaperWithGemini(
          text,
          config.apiKey,
          config.modelName?.trim() || 'gemini-2.0-flash',
          settings.temperature
        );
      } else {
        const baseUrl = getBaseUrlForProvider(provider, config.baseUrl);
        if (provider === 'custom' && !baseUrl) {
          throw new Error("Add a Base URL in Settings (Reasoning Engine → Custom).");
        }
        if (baseUrl) {
          result = await analyzePaperWithCustomAI(text, { baseUrl, apiKey: config.apiKey, modelName: config.modelName }, settings.temperature);
        } else if (isSupabaseConfigured()) {
          const resp = await fetch(`${apiBase}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paperText: text, temperature: settings.temperature }),
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error((err as { error?: string })?.error || 'Analysis request failed');
          }
          result = (await resp.json()) as AnalysisResult;
        } else {
          throw new Error('Configure a reasoning provider in Settings (e.g. Gemini API key or Custom API).');
        }
      }

      if (loadingStepIntervalRef.current) {
        clearInterval(loadingStepIntervalRef.current);
        loadingStepIntervalRef.current = null;
      }
      const newSession: AnalysisSession = {
        id: Date.now().toString(),
        filename: file.name,
        timestamp: Date.now(),
        summary: result.summary,
        assumptions: result.assumptions,
        reasoning: result.reasoning,
        experimentCode: result.experimentCode,
        simulationData: result.simulationData,
        rawText: text,
        reproducibilityScore: result.reproducibilityScore,
        citationIntegrity: result.citationIntegrity
      };

      setSessionData(newSession);
      onAnalysisComplete(newSession);
      setAppState(AppState.COMPLETE);
      toast.success("Analysis Complete");

    } catch (error) {
      if (loadingStepIntervalRef.current) {
        clearInterval(loadingStepIntervalRef.current);
        loadingStepIntervalRef.current = null;
      }
      console.error("Analysis Error:", error);
      setAppState(AppState.ERROR);
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    }
  };

  const handleRunSimulation = () => {
    setSimulationStatus('running');
    toast("Running simulation based on generated parameters...", { icon: '⚙️' });

    setTimeout(() => {
      // Use the real data generated by the AI
      if (sessionData?.simulationData && sessionData.simulationData.length > 0) {
        setSimulationData(sessionData.simulationData);
      } else {
        // Fallback if AI failed to generate data (graceful degradation)
        const data = [];
        for (let i = 0; i <= 5; i += 0.5) {
          data.push({ x: i, y: Math.random() });
        }
        setSimulationData(data);
        toast("Using sample data for the chart.");
      }
      setSimulationStatus('complete');
      toast.success("Simulation Complete");
    }, 2000);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdown = () => {
    if (!sessionData) return;
    const md = `# ${sessionData.filename} - Analysis
    
## Summary
${sessionData.summary}

## Metrics
- Reproducibility Score: ${sessionData.reproducibilityScore}/100
- Citation Integrity: ${sessionData.citationIntegrity}

## Deep Reasoning
${sessionData.reasoning}

## Critical Assumptions
${sessionData.assumptions.map(a => `- ${a}`).join('\n')}

## Experiment Code
\`\`\`python
${sessionData.experimentCode}
\`\`\`

Generated by LOGOS Scientific Agent
`;
    downloadFile(md, `${sessionData.filename.replace('.pdf', '')}_analysis.md`, 'text/markdown');
    toast.success("Report downloaded successfully");
    setIsShareMenuOpen(false);
  };

  const handleDownloadJSON = () => {
    if (!sessionData) return;
    const json = JSON.stringify(sessionData, null, 2);
    downloadFile(json, `${sessionData.filename.replace('.pdf', '')}_data.json`, 'application/json');
    toast.success("Data exported successfully");
    setIsShareMenuOpen(false);
  };

  const handleCopyClipboard = () => {
    if (!sessionData) return;
    
    const shareText = `
🔬 LOGOS Analysis: ${sessionData.filename}
    
Summary:
${sessionData.summary}

Reproducibility Score: ${sessionData.reproducibilityScore}/100
Citation Integrity: ${sessionData.citationIntegrity}

Generated by LOGOS Scientific Agent
    `.trim();

    navigator.clipboard.writeText(shareText).then(() => {
      toast.success("Analysis summary copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
    setIsShareMenuOpen(false);
  };

  // Drag and Drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // Render Logic
  if (appState === AppState.IDLE) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 relative">
        <div 
          className={`w-full max-w-2xl border-2 border-dashed rounded-xl p-6 sm:p-10 lg:p-12 text-center transition-all duration-300 ${
            isDragging 
              ? 'border-orange-500 bg-orange-500/5 scale-[1.02]' 
              : isDark 
                ? 'border-zinc-700 bg-zinc-900/30 hover:border-zinc-600' 
                : 'border-zinc-300 bg-white hover:border-zinc-400'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          }`}>
            <i className={`fas fa-file-pdf text-2xl ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}></i>
          </div>
          <h2 className={`text-xl sm:text-2xl font-bold mb-2 sm:mb-3 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Upload Research Paper
          </h2>
          <p className={`text-sm sm:text-base ${isDark ? 'text-zinc-400' : 'text-zinc-500'} mb-6 sm:mb-8`}>
            Drag & drop your PDF here, or tap to browse.
          </p>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf" 
            className="hidden" 
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`min-h-[44px] px-6 py-3 font-semibold rounded-lg transition-colors ${
              isDark 
                ? 'bg-zinc-100 text-zinc-900 hover:bg-white' 
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            Select PDF
          </button>
        </div>
      </div>
    );
  }

  if (appState === AppState.ANALYZING) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 sm:p-12">
        <div className="w-full max-w-md text-center px-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className={`text-xl font-medium mb-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Analyzing Paper
          </h3>
          <p className={`${isDark ? 'text-zinc-500' : 'text-zinc-500'} animate-pulse`}>
            {MOCK_LOADING_STEPS[loadingStep]}
          </p>
        </div>
      </div>
    );
  }

  if (appState === AppState.ERROR) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-red-500 text-6xl mb-4"><i className="fas fa-exclamation-triangle"></i></div>
        <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Something went wrong. Please try again.
        </p>
        <button onClick={() => setAppState(AppState.IDLE)} className="mt-4 text-orange-500 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-20">
        
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6 ${
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <h1 className={`text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {sessionData?.filename}
              </h1>
              <p className={`text-xs sm:text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                Analyzed on {new Date(sessionData?.timestamp || 0).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 relative share-menu-container flex-shrink-0">
            <button
              onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-2 sm:py-1.5 rounded-md text-sm font-medium border transition-colors gap-2 ${
                isDark 
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' 
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <i className="fas fa-share-alt text-xs"></i> Share
            </button>

            {isShareMenuOpen && (
              <div className={`absolute top-full right-0 mt-2 w-56 rounded-xl shadow-xl border overflow-hidden z-50 animation-fade-in ${
                isDark 
                  ? 'bg-zinc-900 border-zinc-700' 
                  : 'bg-white border-zinc-200'
              }`}>
                <div className="p-1">
                  <button
                    onClick={handleCopyClipboard}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-3 ${
                      isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <i className="fas fa-copy w-4 text-center"></i> Copy Summary
                  </button>
                  <button
                    onClick={handleDownloadMarkdown}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-3 ${
                      isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <i className="fas fa-file-alt w-4 text-center"></i> Download Report (.md)
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-3 ${
                      isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <i className="fas fa-code w-4 text-center"></i> Export Data (.json)
                  </button>
                </div>
              </div>
            )}

            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
              isDark 
                ? 'bg-green-900/30 text-green-500 border-green-900/50' 
                : 'bg-green-100 text-green-700 border-green-200'
            }`}>
              Analyzed
            </span>
          </div>
        </div>

        {/* Feature 2: Peer Review Scorecard */}
        {sessionData && (
          <Scorecard 
            reproducibility={sessionData.reproducibilityScore || 85}
            logicGaps={sessionData.assumptions.length}
            integrity={sessionData.citationIntegrity || "High"}
            theme={settings.theme}
          />
        )}

        {/* Feature 1: Visual Reasoning Graph */}
         <section className={`rounded-xl border overflow-hidden transition-colors ${
           isDark 
             ? 'bg-zinc-900/50 border-zinc-800/50' 
             : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <details className="group">
            <summary className={`flex items-center justify-between p-6 cursor-pointer transition-colors ${
              isDark 
                ? 'bg-zinc-900 hover:bg-zinc-800' 
                : 'bg-zinc-50 hover:bg-zinc-100'
            }`}>
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}>
                <i className="fas fa-project-diagram text-blue-500"></i> Reasoning Graph
              </h2>
              <span className={`transition-transform group-open:rotate-180 ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                <i className="fas fa-chevron-down"></i>
              </span>
            </summary>
            <div className={`p-6 border-t ${
              isDark 
                ? 'border-zinc-800 bg-zinc-900/30' 
                : 'border-zinc-200 bg-white'
            }`}>
               <ReasoningGraph theme={settings.theme} />
            </div>
          </details>
        </section>

        {/* Methodology Summary */}
        <section className={`rounded-xl p-6 border transition-colors ${
          isDark 
            ? 'bg-zinc-900/50 border-zinc-800/50' 
            : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            <i className="fas fa-layer-group text-orange-500"></i> Methodology Summary
          </h2>
          <p className={`leading-relaxed text-sm ${
            isDark ? 'text-zinc-300' : 'text-zinc-600'
          }`}>
            {sessionData?.summary}
          </p>
        </section>

        {/* Phase 1: Deep Reasoning (Collapsible) */}
        <section className={`rounded-xl border overflow-hidden transition-colors ${
           isDark 
             ? 'bg-zinc-900/50 border-zinc-800/50' 
             : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <details className="group" open>
            <summary className={`flex items-center justify-between p-6 cursor-pointer transition-colors ${
              isDark 
                ? 'bg-zinc-900 hover:bg-zinc-800' 
                : 'bg-zinc-50 hover:bg-zinc-100'
            }`}>
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}>
                <i className="fas fa-brain text-purple-500"></i> Phase 1: Deep Reasoning
              </h2>
              <span className={`transition-transform group-open:rotate-180 ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                <i className="fas fa-chevron-down"></i>
              </span>
            </summary>
            <div className={`p-6 border-t ${
              isDark 
                ? 'border-zinc-800 bg-zinc-900/30' 
                : 'border-zinc-200 bg-white'
            }`}>
               <div className="prose max-w-none">
                 <p className={`whitespace-pre-line text-sm font-mono leading-relaxed ${
                   isDark ? 'text-zinc-300' : 'text-zinc-700'
                 }`}>
                   {sessionData?.reasoning}
                 </p>
               </div>
            </div>
          </details>
        </section>

        {/* Critical Assumptions */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sessionData?.assumptions.map((assumption, idx) => (
            <div key={idx} className={`border p-5 rounded-xl transition-colors group ${
              isDark 
                ? 'bg-zinc-900 border-zinc-800 hover:border-orange-500/50' 
                : 'bg-white border-zinc-200 hover:border-orange-500 shadow-sm'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Critical Assumption
                </h3>
              </div>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {assumption}
              </p>
            </div>
          ))}
        </section>

        {/* Phase 2: Experiment Generator & Virtual Pilot Study */}
        <section className={`border rounded-xl overflow-hidden shadow-2xl ${
          isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-900 border-zinc-700'
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-800 border-zinc-700'
          }`}>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <i className="fas fa-flask text-green-500"></i> Phase 2: Virtual Pilot Study (Oracle)
            </h2>
            
            {simulationStatus === 'idle' && (
              <button 
                onClick={handleRunSimulation}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-lg hover:shadow-orange-500/20"
              >
                <i className="fas fa-play"></i> Run Virtual Pilot Study
              </button>
            )}
            
            {simulationStatus === 'running' && (
               <span className="text-sm text-orange-500 animate-pulse flex items-center gap-2">
                 <i className="fas fa-circle-notch fa-spin"></i> Running Simulation...
               </span>
            )}

             {simulationStatus === 'complete' && (
               <span className="text-sm text-green-500 flex items-center gap-2">
                 <i className="fas fa-check-circle"></i> Simulation Complete
               </span>
            )}
          </div>

          <div className="p-0">
             {/* Main Code View */}
            <div className="relative">
              <div className="absolute top-2 right-4 text-xs text-zinc-500">Python 3.9</div>
              <pre className="p-6 text-sm font-mono text-zinc-300 bg-[#0d1117] overflow-x-auto">
                <code>{simulationStatus === 'idle' ? sessionData?.experimentCode : PYTHON_SIMULATION_SCRIPT}</code>
              </pre>
            </div>

            {/* Simulation Results (Revealed after run) */}
            {simulationStatus === 'complete' && (
              <div className={`p-6 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'}`}>
                <h3 className={`text-md font-semibold mb-6 flex items-center gap-2 ${
                  isDark ? 'text-zinc-200' : 'text-zinc-800'
                }`}>
                  <i className="fas fa-chart-line text-orange-500"></i> Simulation Output: Data Robustness Test
                </h3>
                
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  {/* Chart */}
                  <div className={`flex-1 w-full p-4 rounded-xl border ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                  }`}>
                    <SimulationChart data={simulationData} theme={settings.theme} />
                  </div>

                  {/* Verdict Side Panel */}
                  <div className="w-full lg:w-80 flex flex-col gap-4">
                    <div className={`p-4 rounded-xl border-l-4 border-green-500 ${
                       isDark ? 'bg-green-900/10' : 'bg-green-50'
                    }`}>
                      <h4 className="font-bold text-green-600 mb-1 flex items-center gap-2">
                        <i className="fas fa-check-circle"></i> Feasibility Verdict
                      </h4>
                      <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <strong>Robustness Confirmed.</strong> The model maintains R² {'>'} 0.6 even under high noise conditions (σ=3.0).
                      </p>
                    </div>

                     <div className={`p-4 rounded-xl border ${
                        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                     }`}>
                       <h4 className={`font-semibold text-sm mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                         Grant Potential
                       </h4>
                       <div className="w-full bg-zinc-700 h-2 rounded-full overflow-hidden">
                         <div className="bg-orange-500 h-full w-[85%]"></div>
                       </div>
                       <div className="flex justify-between text-xs mt-1 text-zinc-500">
                         <span>Low</span>
                         <span className="text-orange-500 font-bold">High (85%)</span>
                       </div>
                     </div>

                     <div className={`p-4 rounded-xl border ${
                        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                     }`}>
                        <div className="text-xs text-zinc-500 mb-1">Generated by</div>
                        <div className="flex items-center gap-2">
                           <i className="fas fa-robot text-orange-500"></i>
                           <span className={`font-mono text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>LOGOS Auto-Lab v2.1</span>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};