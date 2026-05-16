import { chromium } from 'playwright';
import { Surfex } from '@surfex-ai/sdk';
import { PlaywrightDriver } from '@surfex-ai/sdk/playwright';
import { anthropic } from '@ai-sdk/anthropic';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    const agent = new Surfex({ 
        model: anthropic(process.env.AGENT_MODEL || 'claude-3-5-sonnet-20241022') 
    });

    console.log("Running E2E Test...");

    const result = await agent.run({
        goal: "Navigate to github.com, search for 'playwright', and click on the first repository result.",
        driver: new PlaywrightDriver(page),
        generateReport: false,      // Skip report for simple UI testing
        generateConclusion: false   // Skip conclusion for raw testing speed
    });

    console.log("Test Success:", result.success);
    console.log("Agent Summary:", result.summary);

    await browser.close();
}

main().catch(console.error);
