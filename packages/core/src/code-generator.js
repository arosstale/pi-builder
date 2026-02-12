export class CodeGenerator {
    model = 'claude-3.5-sonnet';
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.CLAUDE_API_KEY;
    }
    async generate(request) {
        if (!this.apiKey) {
            throw new Error('API key not configured. Set CLAUDE_API_KEY or pass it to constructor');
        }
        // Build prompt with context
        const fullPrompt = this.buildPrompt(request);
        // Call AI API
        const response = await this.callAI(fullPrompt);
        const tokensUsed = this.estimateTokens(fullPrompt + response.text);
        return {
            code: response.text,
            language: request.language || 'typescript',
            explanation: response.explanation || '',
            metadata: {
                tokensUsed,
                generatedAt: new Date(),
                model: this.model,
            },
        };
    }
    buildPrompt(request) {
        let builtPrompt = request.prompt;
        if (request.context) {
            builtPrompt += '\n\nContext:\n';
            for (const [key, value] of Object.entries(request.context)) {
                builtPrompt += `${key}: ${JSON.stringify(value)}\n`;
            }
        }
        if (request.framework) {
            builtPrompt += `\nFramework: ${request.framework}`;
        }
        return builtPrompt;
    }
    async callAI(_prompt) {
        // Mock implementation - replace with actual Claude API call
        return {
            text: '// Generated code will appear here\nconsole.log("Hello, Pi Builder!")',
            explanation: 'Mock response from AI provider',
        };
    }
    estimateTokens(text) {
        // Rough estimate: ~1 token per 4 characters
        return Math.ceil(text.length / 4);
    }
}
//# sourceMappingURL=code-generator.js.map