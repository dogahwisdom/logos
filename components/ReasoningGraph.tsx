import React from 'react';

interface ReasoningGraphProps {
  theme: 'dark' | 'light';
}

export const ReasoningGraph: React.FC<ReasoningGraphProps> = ({ theme }) => {
  const isDark = theme === 'dark';

  const steps = [
    {
      title: "Paper Ingested",
      icon: "fas fa-file-import",
      status: "complete",
      detail: "PDF Text Extraction"
    },
    {
      title: "Methodology Scan",
      icon: "fas fa-search",
      status: "complete",
      detail: "Identifying Variables"
    },
    {
      title: "Gap Detected",
      icon: "fas fa-exclamation-circle",
      status: "active",
      detail: "Missing Control Group"
    },
    {
      title: "Hypothesis",
      icon: "fas fa-lightbulb",
      status: "pending",
      detail: "False Positive Risk High"
    },
    {
      title: "Recommendation",
      icon: "fas fa-check-double",
      status: "pending",
      detail: "Simulate Placebo Arm"
    }
  ];

  return (
    <div className={`p-6 flex flex-col items-center justify-center w-full`}>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-0 md:gap-4 relative">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            {/* Step Node */}
            <div className="flex flex-row md:flex-col items-center gap-4 md:gap-2 z-10 relative group">
              
              {/* Icon Bubble */}
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg shadow-sm transition-all duration-300 ${
                step.status === 'active'
                  ? 'border-orange-500 bg-orange-500 text-white scale-110 shadow-orange-500/20'
                  : isDark 
                    ? 'border-zinc-700 bg-zinc-900 text-zinc-500' 
                    : 'border-zinc-300 bg-white text-zinc-400'
              }`}>
                <i className={step.icon}></i>
              </div>

              {/* Text Content */}
              <div className={`text-left md:text-center w-full md:w-32 transition-colors ${
                step.status === 'active' 
                  ? (isDark ? 'text-white' : 'text-zinc-900') 
                  : (isDark ? 'text-zinc-500' : 'text-zinc-400')
              }`}>
                <div className="font-semibold text-sm">{step.title}</div>
                <div className="text-xs opacity-80">{step.detail}</div>
              </div>

            </div>

            {/* Connector Line (Horizontal for Desktop, Vertical for Mobile logic handled via flex direction) */}
            {idx < steps.length - 1 && (
              <div className={`
                hidden md:block h-0.5 flex-1 w-12 mt-6 -ml-2 -mr-2 transition-colors
                ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}
              `}></div>
            )}
             {/* Mobile Connector */}
             {idx < steps.length - 1 && (
              <div className={`
                md:hidden w-0.5 h-8 ml-6 my-1 transition-colors
                ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}
              `}></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};