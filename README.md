<div align="center">
  <h1>🏄‍♂️ Surfex AI SDK</h1>
  <p><strong>A production-ready, agentic browser automation library built on top of the Vercel AI SDK.</strong></p>

  <a href="https://www.npmjs.com/package/@surfex-ai/sdk"><img src="https://img.shields.io/npm/v/@surfex-ai/sdk?style=flat-square&color=0070f3" alt="NPM Version" /></a>
  <a href="https://github.com/surfex-ai/sdk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Powered%20by-Vercel%20AI%20SDK-black?style=flat-square&logo=vercel" alt="Vercel AI SDK" />
</div>

<br />

Give **Surfex** a goal and an LLM model, and it will autonomously navigate, read, click, scroll, and interact with the web to achieve it. Whether you are building an automated research assistant, a self-healing E2E testing pipeline, or a dynamic data scraper, Surfex provides the reliable agentic loop you need.

---

## ✨ Why Surfex?

- 🧠 **Bring Your Own Model (BYOM):** Fully compatible with any provider supported by the Vercel AI SDK (`@ai-sdk/anthropic`, `@ai-sdk/openai`, etc.). You control the API keys and the costs.
- 👁️ **Native Vision Support:** Surfex automatically takes screenshots and passes them to vision-capable models (like Claude 3.5 Sonnet or GPT-4o) for flawless coordinate clicking and visual context.
- 🩹 **Self-Healing Execution:** Built-in JSON repair and retry logic prevents agent crashes from hallucinated or malformed LLM outputs.
- 📊 **Automated Reporting:** Includes an internal secondary LLM loop that automatically synthesizes raw web data into beautiful, properly cited Markdown research reports.
- 🔌 **Agnostic Driver Architecture:** Surfex does not lock you into a single browser. The abstract `BrowserDriver` interface allows you to run Surfex inside Playwright, Electron, Puppeteer, or any custom environment.

---

## 📦 Installation

To use Surfex, you need to install the SDK along with your preferred browser driver (`playwright` is supported out-of-the-box) and your preferred LLM provider.

```bash
# 1. Install Surfex and Playwright
npm install @surfex-ai/sdk playwright

# 2. Install the Vercel AI SDK and your LLM provider of choice
npm install ai @ai-sdk/anthropic 
```

*(Note: Playwright is installed directly by you so that Surfex doesn't lock you into a specific browser version.)*

---

## 🚀 Quick Start

Here is the absolute simplest way to use Surfex:

```typescript
const result = await agent.run({
    goal: "Play an 1 hour long Lo-fi playlist on youtube.",
    driver: new PlaywrightDriver(page)
});

```

### 📚 Full Examples

Want to see complete, runnable code? Check out the [`examples/`](./examples) directory in this repository:

- 🧪 [**`examples/e2e-testing.ts`**](./examples/e2e-testing.ts): Learn how to disable the reporting pipeline for lightning-fast UI testing and element clicking.
- 🕵️ [**`examples/research-agent.ts`**](./examples/research-agent.ts): Learn how to turn Surfex into a full-blown autonomous researcher that reads web pages and outputs beautiful Markdown reports.

---

## 🎯 Primary Use Cases

1. **Autonomous Research Agents:** Give Surfex a broad goal ("Find the top 3 AI startups and summarize their pricing"). The agent will navigate the web, use the `save_report` action on relevant pages, and output a beautifully formatted Markdown brief.
2. **Self-Healing E2E Tests:** Traditional CSS selectors break easily. Surfex uses vision to click on elements ("Click the checkout button"), meaning your UI tests survive DOM changes and redesigns.
3. **Data Extraction Pipelines:** Scrape dynamic, React/SPA heavy websites by having an agent actively scroll, wait for network requests, and extract data exactly as a human would.

---

## ⚙️ Configuration & API Reference

### `new Surfex(options: SurfexOptions)`
Creates a new instance of the Surfex orchestrator.
- `model` (LanguageModel): The Vercel AI SDK model instance you want the agent to use for its internal loop.

### `agent.run(options: RunOptions): Promise<SurfexResult>`
Executes the autonomous loop until the goal is achieved, max steps are reached, or an error occurs.

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `goal` | `string` | **Required** | The natural language prompt instructing the agent what to achieve. |
| `driver` | `BrowserDriver` | **Required** | The adapter controlling the browser (e.g., `new PlaywrightDriver(page)`). |
| `maxSteps` | `number` | `60` | The absolute maximum number of actions the agent can take before aborting. |
| `generateReport` | `boolean` | `true` | If true, triggers a secondary LLM call to compile saved page segments into a Markdown document. |
| `generateConclusion` | `boolean` | `true` | If true, triggers a secondary LLM call to write a friendly summary of the execution. |
| `onEvent` | `function` | `() => {}` | Callback fired on agent events (`log`, `step`, `error`, `finished`). |

### `SurfexResult`
The rich object returned when the run finishes:
- `success` (`boolean`): Whether the agent successfully achieved the goal or aborted.
- `summary` (`string`): The raw technical summary of the final action.
- `conclusion` (`string`): A friendly, human-readable summary written by the LLM.
- `report` (`string | null`): The generated Markdown document containing all findings (populated if `generateReport` was true and the agent saved segments).

---

## 🛠️ Bring Your Own Driver (Advanced)

Surfex is completely decoupled from Playwright. If you are building an Electron app, a Puppeteer scraper, or a custom Chromium fork, you can easily implement your own driver by satisfying the `BrowserDriver` interface:

```typescript
import { BrowserDriver } from '@surfex-ai/sdk';

export class MyCustomDriver implements BrowserDriver {
    async goto(url: string): Promise<void> { /* ... */ }
    async click(x: number, y: number): Promise<void> { /* ... */ }
    async type(text: string): Promise<void> { /* ... */ }
    async getScreenshot(): Promise<string> { /* return base64 png */ }
    async evaluate<T>(script: string): Promise<T> { /* ... */ }
    async waitForTimeout(ms: number): Promise<void> { /* ... */ }
}

// Pass it directly to Surfex!
agent.run({ driver: new MyCustomDriver(), goal: "..." });
```

---

<div align="center">
  <p>Built with ❤️ by the Surfex AI Team</p>
</div>
