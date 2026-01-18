
import React, { useMemo } from 'react';
import { IVSMetrics } from '../types';

interface WorkspaceNode {
  id: string;
  label: string;
  type: 'CORE' | 'MEMORY' | 'SEARCH' | 'VALUATION' | 'INPUT';
  strength: number;
}

interface WorkspaceProps {
  active: boolean;
  metrics: IVSMetrics;
  lastInput: string;
  memories: string[];
}

const GlobalWorkspace: React.FC<WorkspaceProps> = ({ active, metrics, lastInput, memories }) => {
  const nodes = useMemo(() => {
    const list: WorkspaceNode[] = [
      { id: '1', label: 'GENESIS_CORE', type: 'CORE', strength: metrics.coherence },
      { id: '2', label: 'INPUT_STREAM', type: 'INPUT', strength: 1 },
      { id: '3', label: 'IVS_VALUATION', type: 'VALUATION', strength: metrics.complexity },
    ];
    
    memories.forEach((m, i) => {
      list.push({ id: `mem-${i}`, label: `MEM_${i}`, type: 'MEMORY', strength: 0.7 });
    });

    return list;
  }, [metrics, memories]);

  return (
    <div className="relative w-full h-full bg-[#05050a] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
      <div className="absolute top-6 left-6 z-10">
        <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em] mb-1">Global Workspace Broadcast</h3>
        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Active Salience Mapping</p>
      </div>

      <svg className="w-full h-full">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dynamic Connection Lines */}
        {nodes.map((node, i) => (
          node.id !== '1' && (
            <line
              key={`line-${node.id}`}
              x1="50%" y1="50%"
              x2={`${20 + (i * 15)}%`} y2={`${30 + (i % 2 * 40)}%`}
              stroke={active ? "rgba(6, 182, 212, 0.4)" : "rgba(255, 255, 255, 0.05)"}
              strokeWidth="1"
              strokeDasharray="4 4"
              className={active ? "animate-[dash_2s_linear_infinite]" : ""}
            />
          )
        ))}

        {/* Node Visualization */}
        {nodes.map((node, i) => {
          const isCore = node.type === 'CORE';
          const x = isCore ? "50%" : `${20 + (i * 15)}%`;
          const y = isCore ? "50%" : `${30 + (i % 2 * 40)}%`;
          
          return (
            <g key={node.id} className="transition-all duration-1000">
              <circle
                cx={x} cy={y}
                r={isCore ? 40 : 25}
                fill="transparent"
                stroke={node.type === 'CORE' ? '#06b6d4' : node.type === 'MEMORY' ? '#8b5cf6' : '#10b981'}
                strokeWidth="1"
                strokeOpacity={active ? 1 : 0.2}
                className={active ? "animate-pulse" : ""}
                filter="url(#glow)"
              />
              <text
                x={x} y={y}
                dy="4"
                textAnchor="middle"
                className="fill-white text-[7px] font-black uppercase tracking-tighter pointer-events-none"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-6 right-6 text-right max-w-xs">
        <div className="text-[8px] font-black text-slate-600 uppercase mb-2">Workspace Content</div>
        <div className="text-[10px] text-cyan-200/50 italic line-clamp-2 uppercase tracking-tighter font-mono">
          {lastInput || "Awaiting signal..."}
        </div>
      </div>

      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
      `}</style>
    </div>
  );
};

export default GlobalWorkspace;
