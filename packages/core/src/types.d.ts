export interface BuilderConfig {
    name: string;
    description?: string;
    rootDir: string;
    platforms: ('web' | 'desktop' | 'mobile' | 'cli')[];
    aiProvider?: 'claude' | 'openai' | 'custom';
    apiKey?: string;
}
export interface BuilderOptions {
    verbose?: boolean;
    dryRun?: boolean;
    parallel?: boolean;
}
export interface ProjectMetadata {
    id: string;
    name: string;
    description: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
    platforms: string[];
}
export interface CodeGenerationRequest {
    prompt: string;
    context?: Record<string, any>;
    language?: string;
    framework?: string;
}
export interface CodeGenerationResponse {
    code: string;
    language: string;
    explanation: string;
    metadata: {
        tokensUsed: number;
        generatedAt: Date;
        model: string;
    };
}
//# sourceMappingURL=types.d.ts.map