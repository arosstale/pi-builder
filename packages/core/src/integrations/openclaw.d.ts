/**
 * OpenClaw Integration
 * Integrates with OpenClaw for web scraping and data collection
 */
export interface OpenClawConfig {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
}
export interface ScrapingTask {
    id: string;
    url: string;
    selector?: string;
    options?: Record<string, unknown>;
}
export interface ScrapingResult {
    url: string;
    data: unknown[];
    status: 'success' | 'failed';
    timestamp: Date;
}
export declare class OpenClawIntegration {
    private tasks;
    private baseUrl;
    constructor(config?: OpenClawConfig);
    scrapeUrl(url: string, selector?: string): Promise<ScrapingResult>;
    scrapeMultiple(urls: string[]): Promise<ScrapingResult[]>;
    extractData(_html: string, selector: string): Promise<Record<string, unknown>[]>;
    getTaskStatus(taskId: string): ScrapingTask | undefined;
    private mockScrape;
}
//# sourceMappingURL=openclaw.d.ts.map