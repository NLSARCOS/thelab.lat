# 🏰 VibeCheck Security: The Gurkha Engine
> Elite AI Inference Firewall & Repo Vulnerability Auditor

## 🛡️ Overview
VibeCheck Security provides a military-grade security layer for decentralized and corporate AI applications. It protects against Prompt Injection, Data Leaks, and Insecure Output Execution.

## 🛠️ Components
- **Gurkha Core (API)**: Fastify + TypeScript backend providing real-time inference shielding.
- **VFS Auditor**: SAST Scanner specialized in LLM-specific vulnerabilities (eval, key leaks, etc).
- **Vibe-CLI**: Direct-to-terminal security auditing for developers.
- **Neural Dashboard**: Premium React/Vite interface for threat monitoring and audit history.

## 🚀 Quick Start (CLI)
```bash
# Clone and Install
npm install axios
# Scan current project
node vibe-cli.js .
```

## 🔐 Detection Rules
- `LLM-KEY-LEAK`: Detects hardcoded OpenAI/Google/GitHub credentials.
- `LLM-JAILBREAK-SHIELD`: Real-time scoring for DAN/Jailbreak patterns.
- `LLM-EVAL-RCE`: Prevents dangerous dynamic execution of AI outputs.
- `LLM-INJECTION-FIREWALL`: Filters user inputs before hitting the inference bridge.

---
Built by **TheLab.lat** // Powered by **Antigravity Élite**
