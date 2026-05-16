import type { Page } from 'playwright';
import { BrowserDriver } from './BrowserDriver';

export class PlaywrightDriver implements BrowserDriver {
    constructor(private page: Page) {}

    async goto(url: string): Promise<void> {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    async click(x: number, y: number): Promise<void> {
        await this.page.mouse.click(x, y);
    }

    async type(text: string): Promise<void> {
        // Types into the currently focused element, or we can use keyboard.insertText
        await this.page.keyboard.insertText(text);
    }

    async getScreenshot(): Promise<string> {
        const buffer = await this.page.screenshot({ type: 'png' });
        return buffer.toString('base64');
    }

    async evaluate<T>(script: string): Promise<T> {
        return await this.page.evaluate<T>(script);
    }

    async waitForTimeout(ms: number): Promise<void> {
        await this.page.waitForTimeout(ms);
    }
}
