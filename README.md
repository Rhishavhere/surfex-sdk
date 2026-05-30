<div align="center">

# Surfex AI SDK

**Agentic browser automation - vision-first, self-healing, research-ready.**

[![npm](https://img.shields.io/npm/v/@surfex-ai/sdk?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@surfex-ai/sdk)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Vercel AI SDK](https://img.shields.io/badge/Powered%20by-Vercel%20AI%20SDK-black?style=flat-square&logo=vercel)](https://sdk.vercel.ai/)

Give Surfex a **goal** and a **model**. It navigates, clicks, reads, and reports - all on its own.

</div>

---


| | Feature | What it means |
|---|---|---|
|  | **Bring Your Own Model** | Works with Claude, GPT-4o, Gemini — any Vercel AI SDK provider. You own the keys and costs. |
|  | **Native Vision** | Auto-screenshots fed to vision models. Clicks target what's *visible*, not fragile CSS selectors. |
|  | **Self-Healing** | Built-in JSON repair + retry logic. Malformed LLM output triggers a coercion pass, not a crash. |
|  | **Auto Reports** | A secondary LLM loop compiles saved page content into a structured, cited Markdown document. |
|  | **Driver-Agnostic** | Playwright included. Plug in Puppeteer, Electron, or any custom browser via `BrowserDriver`. |

---

## 📦 Installation

```bash
# 1. Install Surfex + browser driver
npm install @surfex-ai/sdk playwright

# 2. Add the Vercel AI SDK + your LLM provider
npm install ai @ai-sdk/anthropic
```

---

##  Quickstart

```typescript
import { chromium } from 'playwright';
import { Surfex } from '@surfex-ai/sdk';
import { PlaywrightDriver } from '@surfex-ai/sdk/playwright';
import { anthropic } from '@ai-sdk/anthropic';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const agent = new Surfex({ model: anthropic('claude-3-5-sonnet-20241022') });

const result = await agent.run({
  goal: "Play a 1-hour Lo-fi playlist on YouTube.",
  driver: new PlaywrightDriver(page)
});

console.log(result.conclusion);
await browser.close();
```

> No selectors. No XPaths. No element IDs. Just a goal.

---

##  Use Cases

###  Really cool E2E tests
Vision-based clicks survive DOM changes and redesigns. 

```typescript
const result = await agent.run({
  goal: "Go to github.com, search 'playwright', click the first repo result.",
  driver: new PlaywrightDriver(page),
  generateReport: false,     // skip for speed
  generateConclusion: false  // skip for raw testing
});

console.log("Passed:", result.success);
```

---

###  Autonomous planning/research/analysis
Browses multiple sources, extracts content, and produces a Markdown brief — automatically.

```typescript
const result = await agent.run({
  goal: "Research the top 3 AI startups of 2025 from 3 different sites.",
  driver: new PlaywrightDriver(page),
  generateReport: true,
  generateConclusion: true
});

if (result.report) fs.writeFileSync('report.md', result.report, 'utf-8');
```

---

###  Dynamic data extraction
Scrapes React/SPA-heavy pages by scrolling, waiting, and extracting exactly as a human would — no static HTML required.

---

## ⚙️ API Reference

### `new Surfex(options)`

| Option | Type | Description |
|--------|------|-------------|
| `model` | `LanguageModel` | Any Vercel AI SDK model instance |

---

### `agent.run(options)` → `Promise<SurfexResult>`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `goal` | `string` | **required** | Plain-English instruction for the agent |
| `driver` | `BrowserDriver` | **required** | Browser adapter — e.g. `new PlaywrightDriver(page)` |
| `maxSteps` | `number` | `60` | Max actions before the agent aborts |
| `generateReport` | `boolean` | `true` | Compile saved pages into a Markdown report |
| `generateConclusion` | `boolean` | `true` | Write a human-friendly run summary |
| `onEvent` | `function` | `() => {}` | Callback for `log` · `step` · `error` · `finished` events |

---

### `SurfexResult`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the agent completed its goal |
| `summary` | `string` | Raw technical summary of the final action |
| `conclusion` | `string` | Human-friendly LLM-written summary |
| `report` | `string \| null` | Generated Markdown document (populated if pages were saved) |

---

### Listening to events

```typescript
await agent.run({
  goal: "...",
  driver: new PlaywrightDriver(page),
  onEvent: (event) => {
    if (event.type === "step")  console.log(`Step ${event.step}:`, event.action);
    if (event.type === "error") console.error("Error:", event.message);
  }
});
```

---

### Stopping mid-run

```typescript
const agent = new Surfex({ model: anthropic('claude-3-5-sonnet-20241022') });

const runPromise = agent.run({ goal: "...", driver });

agent.stop(); // clean abort, resolves SurfexResult

const result = await runPromise;
```

---

##  Bring Your Own Driver

Implement 6 methods. Pass it in. Done.

```typescript
import { BrowserDriver } from '@surfex-ai/sdk';

export class MyCustomDriver implements BrowserDriver {
  async goto(url: string): Promise<void>           { /* ... */ }
  async click(x: number, y: number): Promise<void> { /* ... */ }
  async type(text: string): Promise<void>           { /* ... */ }
  async getScreenshot(): Promise<string>            { /* return base64 PNG */ }
  async evaluate<T>(script: string): Promise<T>    { /* ... */ }
  async waitForTimeout(ms: number): Promise<void>  { /* ... */ }
}

agent.run({ driver: new MyCustomDriver(), goal: "..." });
```

**Compatible with:** Playwright · Puppeteer · Electron · custom Chromium forks

---

##  How vision mode works

```
Turn 1          →  Blind (no screenshot) — agent plans first action
{"action":"see"} →  Vision mode ON
Turn 2+         →  Screenshot attached every turn
click_xy        →  Pixel coordinates from the screenshot, not the DOM
```

Vision-capable models (Claude 3.5 Sonnet, GPT-4o) click what's *visible on screen* — resilient to any markup or layout change.

---

##  How research reports work

```
agent loop:  navigate → read_page → save_report  (per source, up to 5)
                                        ↓
                          secondary LLM call (report writer)
                                        ↓
                    structured Markdown · cited · sectioned
```

The main agent never writes the report. A dedicated report-writer LLM receives all saved page content and synthesizes it, keeping the agentic loop focused purely on browsing.

---

##  Examples

| File | What it shows |
|------|---------------|
| [`examples/e2e-testing.ts`](./examples/e2e-testing.ts) | Fast UI testing — reports and conclusions disabled |
| [`examples/research-agent.ts`](./examples/research-agent.ts) | Full researcher — saves a Markdown report to disk |

---

## 📄 License

MIT — see [LICENSE](./LICENSE)

---

<div align="center">Built with ❤️ by the creator of Meikai Browser</div>
