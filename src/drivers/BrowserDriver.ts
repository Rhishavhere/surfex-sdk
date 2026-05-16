export interface BrowserDriver {
    /** Navigates to a URL */
    goto(url: string): Promise<void>;
    
    /** Clicks on a specific coordinate */
    click(x: number, y: number): Promise<void>;
    
    /** Types text into the focused element */
    type(text: string): Promise<void>;
    
    /** Retrieves a screenshot of the current page as a base64 string */
    getScreenshot(): Promise<string>;
    
    /** Evaluates javascript in the context of the page */
    evaluate<T>(script: string): Promise<T>;
    
    /** Waits for a specified duration */
    waitForTimeout(ms: number): Promise<void>;
}
