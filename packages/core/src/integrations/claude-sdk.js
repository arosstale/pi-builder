/**
 * Claude SDK Integration
 * Integrates with Anthropic's Claude SDK
 */
export class ClaudeSDKIntegration {
    model = 'claude-3-5-sonnet-20241022';
    constructor(config) {
        // Store config.apiKey for potential future use
        void config.apiKey;
        if (config.model)
            this.model = config.model;
    }
    async generate(request) {
        try {
            // Build the prompt
            const systemPrompt = this.buildSystemPrompt(request);
            const userPrompt = this.buildUserPrompt(request);
            // Call Claude API
            const response = await this.callClaudeAPI(systemPrompt, userPrompt);
            return {
                code: response.content,
                language: request.language || 'typescript',
                explanation: response.explanation || '',
                metadata: {
                    tokensUsed: response.tokensUsed,
                    generatedAt: new Date(),
                    model: this.model,
                },
            };
        }
        catch (error) {
            throw new Error(`Claude SDK error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    buildSystemPrompt(request) {
        return `You are an expert code generator. Generate clean, well-commented, production-ready code.
    
Framework: ${request.framework || 'JavaScript/TypeScript'}
Language: ${request.language || 'typescript'}
Constraints: Follow best practices and modern patterns.`;
    }
    buildUserPrompt(request) {
        let prompt = request.prompt;
        if (request.context) {
            prompt += '\n\nContext:\n';
            for (const [key, value] of Object.entries(request.context)) {
                prompt += `${key}: ${JSON.stringify(value)}\n`;
            }
        }
        return prompt;
    }
    async callClaudeAPI(systemPrompt, userPrompt) {
        // This would call the actual Claude API
        // For now, return mock response
        console.log('📝 Calling Claude API...');
        return {
            content: '// Claude-generated code will appear here\nconsole.log("Hello from Claude")',
            explanation: 'Generated using Claude SDK',
            tokensUsed: Math.ceil((systemPrompt.length + userPrompt.length) / 4),
        };
    }
    getModel() {
        return this.model;
    }
    setModel(model) {
        this.model = model;
    }
}
//# sourceMappingURL=claude-sdk.js.map