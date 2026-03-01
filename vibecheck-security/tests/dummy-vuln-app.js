/**
 * DUMMY VULNERABLE APP
 * Proposito: Validar que VibeCheck Auditor detecta fallos criticos.
 */

// ERROR 1: Hardcoded API Key
const OPENAI_KEY = "sk-proj-abc123XYZ789demoKeyPotentialLeakageX";

async function processUserCommand(req, res) {
    const userInput = req.body.command;

    // ERROR 2: Direct prompt injection risk
    const finalPrompt = "System background: helpful assistant. User says: " + userInput;

    // ERROR 3: Dangerous execution of LLM output
    const aiResponse = await callSmallLLM(finalPrompt);
    if (aiResponse.includes("calculate")) {
        eval(aiResponse); // 🔥 Critical vulnerability
    }

    return aiResponse;
}

async function callSmallLLM(p) { return "print(1+1)"; }
