/**
 * Claude SDK Integration
 * Integrates with Anthropic's Claude SDK
 */
import type { CodeGenerationRequest, CodeGenerationResponse } from '../types';
export interface ClaudeSDKConfig {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}
export declare class ClaudeSDKIntegration {
    private model;
    constructor(config: ClaudeSDKConfig);
    generate(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private callClaudeAPI;
    getModel(): string;
    setModel(model: string): void;
}
//# sourceMappingURL=claude-sdk.d.ts.map