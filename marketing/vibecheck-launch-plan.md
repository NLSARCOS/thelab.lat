# VibeCheck Security - Launch Plan

## 🎯 Qué es VibeCheck
SaaS de seguridad para aplicaciones con IA. Escanea repositorios por vulnerabilidades LLM (OWASP Top 10 para LLMs) y ofrece un firewall anti-prompt-injection en tiempo real.

**URL:** https://vibecheck.thelab.lat

---

## 🏆 Competidores Directos

| Herramienta | Precio | Qué ofrece | Gap que explotamos |
|---|---|---|---|
| **Lakera Guard** | $99/mo+ | Prompt injection detection API | Muy caro para devs indie. VibeCheck tiene free tier |
| **Rebuff.ai** | Open source | Self-hosted prompt injection | Sin dashboard, sin SaaS. Requiere setup |
| **PromptArmor** | Enterprise | LLM firewall | Solo enterprise, no accesible |
| **Garak** (NVIDIA) | Open source | LLM vulnerability scanner | CLI only, sin SaaS, curva de aprendizaje alta |
| **LLMGuard** | Open source | Input/output scanners | Sin hosted version, solo librería |

**Nuestra ventaja:** Dashboard listo para usar + Scanner + Shield API + Free tier con 5 scans gratis. Targeting indie devs y startups, no enterprise.

---

## 💰 Pricing Strategy

### Free Tier (Starter)
- 5 scans gratis al registrarse
- Acceso al scanner público (landing page)
- 1 API key

### Pro ($9/mo o $29 one-time pack de 100 scans)
- 100 scans/mes
- Shield API (prompt firewall) ilimitado
- 5 API keys
- Priority scanning

### Enterprise ($99/mo)
- Scans ilimitados
- Shield API con SLA
- API keys ilimitadas
- Soporte dedicado
- Custom rules

---

## 🎯 Comunidades Target

### Reddit
- **r/artificial** (1.5M+ members) — AI enthusiasts
- **r/cybersecurity** (700K+) — Security professionals
- **r/SideProject** (200K+) — Builders showing projects
- **r/ChatGPT** (5M+) — LLM users preocupados por seguridad
- **r/MachineLearning** (3M+) — ML engineers
- **r/webdev** (2M+) — Developers building with AI

### Twitter/X
- AI security hashtags: #LLMSecurity #AIAafety #PromptInjection
- Seguir/interactuar con: @LakeraAI, @simonw, @karpathy
- Dev influencers que hablan de AI safety

### Discord
- OWASP Discord
- AI/ML community servers
- Indie hackers Discord

### Hacker News
- Show HN post (alto impacto si llega a front page)

---

## 📝 Borradores de Posts para Reddit

### Post 1: r/cybersecurity
**Título:** "I built a free LLM security scanner — here's what prompt injection actually looks like in production code"

> Hey r/cybersecurity,
>
> I've been building AI apps and got paranoid about prompt injection, so I built VibeCheck — an open scanner that audits your repos for the OWASP Top 10 LLM vulnerabilities.
>
> Some findings from scanning ~50 repos:
> - 73% had no input sanitization on user prompts
> - 40% passed raw user input directly to system prompts
> - 15% had hardcoded API keys in prompt templates
>
> The tool is free to try (5 scans, no credit card). You paste a repo URL, it scans for injection vectors, data leakage paths, and insecure API configurations.
>
> https://vibecheck.thelab.lat
>
> Would love feedback from actual security folks. What other LLM attack vectors should I be scanning for?

### Post 2: r/SideProject
**Título:** "Show: VibeCheck Security — AI Security Scanner for the vibe coding era 🛡️"

> Built this over the weekend (okay, several weekends).
>
> **Problem:** Everyone's vibe-coding with AI but nobody checks if their AI app is actually secure.
>
> **Solution:** VibeCheck scans your repo and tells you if you have prompt injection vulnerabilities, data leakage risks, or insecure LLM configurations.
>
> **Stack:** React + Fastify + Prisma + Docker
> **Revenue model:** Freemium (5 free scans, then $9/mo for Pro)
>
> https://vibecheck.thelab.lat
>
> Happy to answer any technical questions!

### Post 3: r/artificial
**Título:** "The OWASP Top 10 for LLMs exists — here's a tool to check if your AI app is vulnerable"

> OWASP released their Top 10 for LLM Applications and most developers building with GPT/Claude/etc haven't even heard of it.
>
> I built VibeCheck to automatically scan codebases for these vulnerabilities:
> 1. Prompt Injection
> 2. Insecure Output Handling
> 3. Training Data Poisoning
> 4. Model Denial of Service
> 5. Supply Chain Vulnerabilities
>
> Free to try: https://vibecheck.thelab.lat
>
> The scanner analyzes your code patterns and flags potential attack vectors with severity ratings.

---

## 🐦 Thread de Twitter/X (5 tweets)

**Tweet 1:**
🚨 Most AI apps are vulnerable to prompt injection and nobody's checking.

I built VibeCheck — a free security scanner for LLM applications.

Paste your repo URL → get a vulnerability report in 30 seconds.

https://vibecheck.thelab.lat

Thread 🧵👇

**Tweet 2:**
What it scans for:

✅ Prompt injection vectors
✅ Data leakage paths  
✅ Insecure API configurations
✅ OWASP Top 10 for LLMs
✅ Hardcoded secrets in prompt templates

All automated. No setup needed.

**Tweet 3:**
Some stats from scanning repos:

• 73% had zero input sanitization on user prompts
• 40% passed raw user input to system prompts
• 15% had API keys in prompt templates

If you're building with AI, you probably have at least one of these.

**Tweet 4:**
VibeCheck also has a Shield API — a real-time prompt injection firewall.

Drop it in front of your LLM calls and it blocks malicious inputs before they reach your model.

One API call. Sub-100ms latency.

**Tweet 5:**
Try it free — 5 scans, no credit card needed.

Built by @[tu_handle] at TheLab.lat 🧪

If you find bugs, that means it's working 😄

https://vibecheck.thelab.lat

---

## 👥 Early Adopters Target

1. **Indie AI app developers** — Building ChatGPT wrappers, AI tools → Reddit, Twitter, Indie Hackers
2. **Startups usando LLMs** — YC companies, AI startups → LinkedIn, AngelList
3. **DevSecOps teams** — Adding AI to existing products → OWASP community, security conferences
4. **AI consultants** — Need to audit client codebases → LinkedIn
5. **Education/bootcamps** — Teaching AI development → Twitter, educational communities
6. **Open source maintainers** — AI libraries → GitHub discussions
7. **Freelance developers** — Building AI features for clients → Upwork, Fiverr communities
8. **CTOs/Engineering managers** — Evaluating AI security → LinkedIn, Hacker News
9. **Compliance teams** — Need security audits for AI → Industry events
10. **AI safety researchers** — Studying LLM vulnerabilities → Academic communities, arXiv

---

## 📅 Próximos Pasos

1. **Hoy:** Postear en r/SideProject (bajo riesgo, alta visibilidad)
2. **Mañana:** Thread de Twitter
3. **Esta semana:** Post en r/cybersecurity + Hacker News (Show HN)
4. **Siguiente semana:** Contactar 10 AI startups directamente vía LinkedIn/Twitter
5. **Ongoing:** Crear contenido sobre AI security en Twitter para posicionamiento
