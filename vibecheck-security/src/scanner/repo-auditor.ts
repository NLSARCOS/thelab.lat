import * as fs from 'fs';
import * as path from 'path';

/**
 * VIBECHECK SECURITY: REPO AUDITOR 🔍
 */

export interface ScanIssue {
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    ruleId: string;
    description: string;
    file: string;
    line?: number;
    suggestion: string;
}

const SECURITY_RULES = [
    {
        id: "LLM-KEY-LEAK",
        pattern: "(sk-proj-[a-zA-Z0-9]{30,}|AIza[0-9A-Za-z-_]{35}|ghp_[a-zA-Z0-9]{36})",
        severity: "CRITICAL" as const,
        description: "Hardcoded Credential (OpenAI/Google/GitHub) detectada.",
        suggestion: "Mueve esta credencial a un gestor de secretos o variables de entorno (.env)."
    },
    {
        id: "LLM-RAW-USER-INPUT",
        pattern: "(prompt|input|query).*=.*(req\\.body|req\\.query|params)",
        severity: "HIGH" as const,
        description: "Inyección directa de input de usuario en prompt del LLM.",
        suggestion: "Implementa una capa de sanitización o usa templates de sistema con variables escapadas."
    },
    {
        id: "LLM-DANGEROUS-CONTENT-TYPE",
        pattern: "dangerouslySetInnerHTML|innerHTML.*response",
        severity: "HIGH" as const,
        description: "Renderizado inseguro de salida de IA detectado (XSS Risk).",
        suggestion: "Sanitiza las respuestas de la IA antes de renderizarlas en el DOM."
    },
    {
        id: "LLM-EVAL-USAGE",
        pattern: "eval\\(|new Function\\(",
        severity: "CRITICAL" as const,
        description: "Uso de ejecución dinámica detectado. Riesgo de Remote Code Execution (RCE).",
        suggestion: "Remueve toda ejecución dinámica de strings provenientes de modelos de lenguaje."
    },
    {
        id: "LLM-SYSTEM-PROMPT-OVERRIDE",
        pattern: "const.*system.*=.*req\\.",
        severity: "MEDIUM" as const,
        description: "El prompt de sistema es configurable dinámicamente por el usuario.",
        suggestion: "Mantén los prompts de sistema en el servidor, nunca permitas que el cliente los defina."
    }
];

export class RepoScanner {
    private issues: ScanIssue[] = [];

    public async scanDirectory(targetPath: string): Promise<ScanIssue[]> {
        console.log(`[VibeCheck Scanner] Iniciando auditoría en: ${targetPath}`);
        this.issues = [];
        await this.walkDir(targetPath);
        return this.issues;
    }

    private async walkDir(dir: string): Promise<void> {
        const files = await fs.promises.readdir(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.promises.stat(filePath);

            if (stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                    await this.walkDir(filePath);
                }
            } else {
                if (this.isAnalyzableFile(file)) {
                    await this.analyzeFile(filePath);
                }
            }
        }
    }

    private isAnalyzableFile(filename: string): boolean {
        const ext = path.extname(filename);
        return ['.ts', '.tsx', '.js', '.jsx', '.py', '.php'].includes(ext);
    }

    private async analyzeFile(filePath: string): Promise<void> {
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
