import React from 'react';

interface DataPoint {
  x: number;
  y: number;
}

interface SimulationChartProps {
  data: DataPoint[];
  theme: 'dark' | 'light';
}

export const SimulationChart: React.FC<SimulationChartProps> = ({ data, theme }) => {
  const isDark = theme === 'dark';
  
  // Chart dimensions
  const width = 600;
  const height = 300;
  const padding = 40;
  
  // Scales
  const maxX = Math.max(...data.map(d => d.x));
  const minX = 0;
  const maxY = 1.0;
  const minY = 0.0;
  
  const xScale = (val: number) => padding + (val - minX) / (maxX - minX) * (width - padding * 2);
  const yScale = (val: number) => height - padding - (val - minY) / (maxY - minY) * (height - padding * 2);

  // Path generator
  const linePath = data.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${xScale(d.x)},${yScale(d.y)}`
  ).join(' ');

  // Axis lines
  const xTicks = [0, 1, 2, 3, 4, 5];
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="w-full overflow-x-auto flex justify-center">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="max-w-2xl overflow-visible">
        {/* Background Grid */}
        {yTicks.map(tick => (
          <line 
            key={`y-${tick}`}
            x1={padding} 
            y1={yScale(tick)} 
            x2={width - padding} 
            y2={yScale(tick)} 
            stroke={isDark ? "#3f3f46" : "#e4e4e7"} 
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}
        {xTicks.map(tick => (
          <line 
            key={`x-${tick}`}
            x1={xScale(tick)} 
            y1={height - padding} 
            x2={xScale(tick)} 
            y2={padding} 
            stroke={isDark ? "#3f3f46" : "#e4e4e7"} 
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Axes */}
        <line 
          x1={padding} y1={height - padding} 
          x2={width - padding} y2={height - padding} 
          stroke={isDark ? "#71717a" : "#71717a"} strokeWidth="2" 
        />
        <line 
          x1={padding} y1={height - padding} 
          x2={padding} y2={padding} 
          stroke={isDark ? "#71717a" : "#71717a"} strokeWidth="2" 
        />

        {/* Data Line */}
        <path 
          d={linePath} 
          fill="none" 
          stroke="#f97316" // Orange-500
          strokeWidth="3" 
          strokeLinecap="round"
          className="drop-shadow-lg"
        />

        {/* Data Points */}
        {data.map((d, i) => (
          <circle 
            key={i}
            cx={xScale(d.x)} 
            cy={yScale(d.y)} 
            r="4" 
            fill={isDark ? "#18181b" : "#ffffff"} 
            stroke="#f97316" 
            strokeWidth="2" 
          />
        ))}

        {/* Labels */}
        <text 
          x={width / 2} y={height - 5} 
          textAnchor="middle" 
          fill={isDark ? "#a1a1aa" : "#52525b"} 
          fontSize="12" 
          fontFamily="monospace"
        >
          Noise Standard Deviation (σ)
        </text>
        <text 
          x={15} y={height / 2} 
          textAnchor="middle" 
          transform={`rotate(-90 15 ${height / 2})`} 
          fill={isDark ? "#a1a1aa" : "#52525b"} 
          fontSize="12" 
          fontFamily="monospace"
        >
          Model R² Score
        </text>

        {/* Tick Labels */}
        {yTicks.map(tick => (
          <text 
            key={`yt-${tick}`} 
            x={padding - 10} 
            y={yScale(tick) + 4} 
            textAnchor="end" 
            fill={isDark ? "#71717a" : "#71717a"} 
            fontSize="10" 
            fontFamily="monospace"
          >
            {tick.toFixed(1)}
          </text>
        ))}
         {xTicks.map(tick => (
          <text 
            key={`xt-${tick}`} 
            x={xScale(tick)} 
            y={height - padding + 20} 
            textAnchor="middle" 
            fill={isDark ? "#71717a" : "#71717a"} 
            fontSize="10" 
            fontFamily="monospace"
          >
            {tick.toFixed(1)}
          </text>
        ))}
      </svg>
    </div>
  );
};