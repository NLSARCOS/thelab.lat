"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SECURITY_RULES = [
    {
        id: "LLM-KEY-LEAK",
        pattern: "(sk-proj-[a-zA-Z0-9]{30,}|AIza[0-9A-Za-z-_]{35}|ghp_[a-zA-Z0-9]{36})",
        severity: "CRITICAL",
        description: "Hardcoded Credential (OpenAI/Google/GitHub) detectada.",
        suggestion: "Mueve esta credencial a un gestor de secretos o variables de entorno (.env)."
    },
    {
        id: "LLM-RAW-USER-INPUT",
        pattern: "(prompt|input|query).*=.*(req\\.body|req\\.query|params)",
        severity: "HIGH",
        description: "Inyección directa de input de usuario en prompt del LLM.",
        suggestion: "Implementa una capa de sanitización o usa templates de sistema con variables escapadas."
    },
    {
        id: "LLM-DANGEROUS-CONTENT-TYPE",
        pattern: "dangerouslySetInnerHTML|innerHTML.*response",
        severity: "HIGH",
        description: "Renderizado inseguro de salida de IA detectado (XSS Risk).",
        suggestion: "Sanitiza las respuestas de la IA antes de renderizarlas en el DOM."
    },
    {
        id: "LLM-EVAL-USAGE",
        pattern: "eval\\(|new Function\\(",
        severity: "CRITICAL",
        description: "Uso de ejecución dinámica detectado. Riesgo de Remote Code Execution (RCE).",
        suggestion: "Remueve toda ejecución dinámica de strings provenientes de modelos de lenguaje."
    },
    {
        id: "LLM-SYSTEM-PROMPT-OVERRIDE",
        pattern: "const.*system.*=.*req\\.",
        severity: "MEDIUM",
        description: "El prompt de sistema es configurable dinámicamente por el usuario.",
        suggestion: "Mantén los prompts de sistema en el servidor, nunca permitas que el cliente los defina."
    }
];
class RepoScanner {
    issues = [];
    async scanDirectory(targetPath) {
        console.log(`[VibeCheck Scanner] Iniciando auditoría en: ${targetPath}`);
        this.issues = [];
        await this.walkDir(targetPath);
        return this.issues;
    }
    async walkDir(dir) {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.promises.stat(filePath);
            if (stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                    await this.walkDir(filePath);
                }
            }
            else {
                if (this.isAnalyzableFile(file)) {
                    await this.analyzeFile(filePath);
                }
            }
        }
    }
    isAnalyzableFile(filename) {
        const ext = path.extname(filename);
        return ['.ts', '.tsx', '.js', '.jsx', '.py', '.php'].includes(ext);
    }
    async analyzeFile(filePath) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            SECURITY_RULES.forEach(rule => {
                const regex = new RegExp(rule.pattern, 'i');
                if (regex.test(line)) {
                    this.issues.push({
                        severity: rule.severity,
                        ruleId: rule.id,
                        description: rule.description,
                        file: filePath,
                        line: index + 1,
                        suggestion: rule.suggestion
                    });
                }
            });
        });
    }
}
exports.RepoScanner = RepoScanner;
