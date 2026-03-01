/**
 * VibeCheck Engine Core
 * Autonomous Token Cost Analysis & Optimizer
 */

interface LLMModel {
    id: string;
    name: string;
    provider: string;
    costPer1MInput: number;
    costPer1MOutput: number;
    latencyAvg: number;
}

const MODELS: LLMModel[] = [
    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", costPer1MInput: 5.00, costPer1MOutput: 15.00, latencyAvg: 800 },
    { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic", costPer1MInput: 15.00, costPer1MOutput: 75.00, latencyAvg: 1200 },
    { id: "kimi-k2.5", name: "Kimi K2.5", provider: "Moonshot", costPer1MInput: 0.00, costPer1MOutput: 0.00, latencyAvg: 2000 }, // Local/Cloud Proxy
];

export async function calculateProjectInferenceSavings(monthlyTokens: number) {
    const baselineCost = (monthlyTokens / 1000000) * (MODELS[0].costPer1MInput + MODELS[0].costPer1MOutput);
    const optimizedCost = (monthlyTokens / 1000000) * (MODELS[2].costPer1MInput); // Kimi is 0 if via Ollama Cloud setup
    
    return {
        baseline: baselineCost,
        optimized: optimizedCost,
        savings: baselineCost - optimizedCost,
        percentage: 100
    };
}
