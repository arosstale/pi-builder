/**
 * OpenCode SDK Integration
 * Integrates with OpenCode SDK for code analysis and generation
 */
import type { CodeGenerationRequest, CodeGenerationResponse } from '../types';
export interface OpenCodeConfig {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
}
export declare class OpenCodeSDKIntegration {
    private baseUrl;
    constructor(config?: OpenCodeConfig);
    analyzeCode(code: string): Promise<{
        issues: string[];
        score: number;
    }>;
    generateWithOpenCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
    private callOpenCodeAPI;
    formatCode(code: string, language: string): Promise<string>;
}
//# sourceMappingURL=opencode-sdk.d.ts.map