# SEO BRIEF — TheLab.lat + VibeCheck Security
## Para: Kimi K2.5 / Minimax M2.5
## Objetivo: Posicionar ambas propiedades en Google

---

## 1. THELAB.LAT

### Keywords objetivo
- "AI digital asset factory"
- "vibe coding security"
- "AI code security scanner"
- "LLM security tool"
- "prompt injection protection"
- "AI startup studio"

### Meta tags a agregar en index.html
```html
<meta name="description" content="TheLab.lat — Elite AI digital asset factory. We build and audit AI-powered products that dominate their ecosystem. Home of VibeCheck Security.">
<meta name="keywords" content="AI security, vibe coding, LLM security, prompt injection, AI startup, digital assets">
<meta property="og:title" content="TheLab.lat — AI Digital Asset Factory">
<meta property="og:description" content="We build and audit AI-powered products that dominate. Home of VibeCheck Security.">
<meta property="og:image" content="https://thelab.lat/og-image.png">
<meta property="og:url" content="https://thelab.lat">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="TheLab.lat — AI Digital Asset Factory">
<meta name="twitter:description" content="We engineer profitable futures. Home of VibeCheck Security.">
<link rel="canonical" href="https://thelab.lat/">
```

---

## 2. VIBECHECK.THELAB.LAT

### Keywords objetivo (alta intención de compra)
- "vibe coding security scanner"
- "AI code vulnerability scanner"
- "GitHub security scanner free"
- "LLM prompt injection scanner"
- "check AI code security"
- "scan GitHub repo for vulnerabilities"
- "openai api key leaked detection"
- "vibecheck security"

### Meta tags a agregar en vibecheck-landing.html
```html
<meta name="description" content="VibeCheck Security — Scan your AI-generated code for vulnerabilities in 2 minutes. Detects prompt injection, secret leakage, unsafe CORS and 17 more AI security risks. Free to start.">
<meta name="keywords" content="vibe coding security, AI code scanner, prompt injection, LLM security, GitHub security scan, API key detection, vibe check security">
<meta property="og:title" content="VibeCheck Security — AI Code Security Scanner">
<meta property="og:description" content="Scan your vibe-coded repo for security vulnerabilities. 20 AI rules. Security score. Free to start.">
<meta property="og:image" content="https://vibecheck.thelab.lat/og-vibecheck.png">
<meta property="og:url" content="https://vibecheck.thelab.lat">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://vibecheck.thelab.lat/">
```

### Blog posts a crear (alta intención SEO)
1. "How to check if your vibe-coded app is secure" → /blog/vibe-coding-security-checklist
2. "Top 10 security risks in AI-generated code" → /blog/ai-code-security-risks
3. "Prompt injection: what it is and how to prevent it" → /blog/prompt-injection-guide
4. "How to secure your OpenAI API key in production" → /blog/secure-openai-api-key

---

## 3. SCHEMA MARKUP (JSON-LD)
Agregar en ambas páginas:
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "VibeCheck Security",
  "applicationCategory": "SecurityApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "operatingSystem": "Web",
  "url": "https://vibecheck.thelab.lat",
  "description": "AI-powered security scanner for vibe-coded projects",
  "creator": {
    "@type": "Organization",
    "name": "TheLab.lat",
    "url": "https://thelab.lat"
  }
}
```

---

## 4. SEARCH CONSOLE
Para verificar thelab.lat en Google Search Console:
- Método recomendado: **DNS TXT record** en Cloudflare
- Ir a: https://search.google.com/search-console
- Agregar propiedad: thelab.lat
- Elegir "Dominio" (no URL)
- Google dará un código TXT tipo: google-site-verification=XXXXXX
- Agregar en DNS de Cloudflare como registro TXT para @

---

## 5. TAREAS PARA KIMI/MINIMAX
1. Agregar todos los meta tags de arriba a los HTML
2. Agregar schema JSON-LD
3. Crear /blog/ con los 4 artículos listados (HTML estático)
4. Verificar que robots.txt y sitemap.xml estén correctos
5. Agregar link a sitemap en el footer de ambas páginas
