import { BrowserDriver } from '../drivers/BrowserDriver';

export interface BlueAgentOptions {
    provider: 'anthropic' | 'openai';
    apiKey: string;
}

export interface RunOptions {
    goal: string;
    driver: BrowserDriver;
}

export class BlueAgent {
    constructor(private options: BlueAgentOptions) {}

    async run(options: RunOptions) {
        console.log(`Starting agent with goal: "${options.goal}"`);
        // TODO: Implement the core loop here
        
        return {
            success: true,
            summary: "Placeholder summary: Agent execution finished."
        };
    }
}
