import { chromium } from 'playwright';
import { Surfex } from '@surfex-ai/sdk';
import { PlaywrightDriver } from '@surfex-ai/sdk/playwright';
import { anthropic } from '@ai-sdk/anthropic';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    const agent = new Surfex({ 
        model: anthropic(process.env.AGENT_MODEL || 'claude-3-5-sonnet-20241022') 
    });

    console.log("Running Research Agent...");

    const result = await agent.run({
        goal: "Research about elon musk from 3 different sites. Save a summary report.",
        driver: new PlaywrightDriver(page),
        generateReport: true,       // Force secondary LLM to compile findings into a markdown report
        generateConclusion: true    // Force secondary LLM to write a friendly summary
    });

    console.log("Success:", result.success);
    console.log("Conclusion:\n", result.conclusion);

    if (result.report) {
        const reportPath = path.join(process.cwd(), 'research_report.md');
        fs.writeFileSync(reportPath, result.report, 'utf-8');
        console.log(`\nMarkdown Report saved to: ${reportPath}`);
    }

    await browser.close();
}

main().catch(console.error);
