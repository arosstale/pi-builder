import type { CodeGenerationRequest, CodeGenerationResponse } from './types';
export declare class CodeGenerator {
    private model;
    private apiKey?;
    constructor(apiKey?: string);
    generate(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
    private buildPrompt;
    private callAI;
    private estimateTokens;
}
//# sourceMappingURL=code-generator.d.ts.map