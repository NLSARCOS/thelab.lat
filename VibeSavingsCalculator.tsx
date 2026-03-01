"use client";

import { useState } from "react";
import { TrendingDown, ArrowRight, Zap, Target } from "lucide-react";

export function VibeSavingsCalculator() {
  const [tokens, setTokens] = useState(500); // en miles
  
  const models = [
    { name: "GPT-4o / Claude Opus", costPer1M: 30, color: "text-red-500" },
    { name: "AgenAuto (Kimi Cloud)", costPer1M: 0.5, color: "text-emerald-500" }
  ];

  const currentCost = (tokens / 1000) * models[0].costPer1M;
  const optimizedCost = (tokens / 1000) * models[1].costPer1M;
  const savings = currentCost - optimizedCost;

  return (
    <div className="p-8 rounded-3xl border border-zinc-200 bg-white shadow-2xl">
      <div className="flex items-center gap-3 mb-8">
        <TrendingDown className="text-emerald-500" size={24} />
        <h3 className="text-xl font-black uppercase tracking-tighter text-zinc-900">Inference Cost Optimizer</h3>
      </div>

      <div className="space-y-8">
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block mb-4">Monthly Token Consumption (K)</label>
          <input 
            type="range" min="10" max="10000" step="10" 
            value={tokens} 
            onChange={(e) => setTokens(parseInt(e.target.value))}
            className="w-full accent-zinc-900"
          />
          <div className="flex justify-between mt-2 text-sm font-bold text-zinc-900">
            <span>{tokens.toLocaleString()}K Tokens</span>
            <span className="text-emerald-600 font-black">~{Math.round((savings/currentCost)*100)}% Savings</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
            <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Standard Cost</span>
            <span className="text-2xl font-black text-zinc-900">${currentCost.toFixed(2)}</span>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <span className="text-[9px] font-bold text-emerald-600 uppercase block mb-1">AgenAuto Cost</span>
            <span className="text-2xl font-black text-emerald-700">${optimizedCost.toFixed(2)}</span>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-100 flex items-center justify-between">
            <div>
                <p className="text-xs text-zinc-500 font-medium">Potential Monthly Savings:</p>
                <p className="text-2xl font-black text-zinc-900">${savings.toFixed(2)} USD</p>
            </div>
            <button className="bg-zinc-900 text-white p-4 rounded-xl hover:bg-black transition-all shadow-lg active:scale-95">
                <ArrowRight size={20} />
            </button>
        </div>
      </div>
    </div>
  );
}
