import type { BuilderConfig, BuilderOptions, ProjectMetadata } from './types';
export declare class Builder {
    private config;
    private metadata;
    constructor(config: BuilderConfig);
    initialize(options?: BuilderOptions): Promise<void>;
    private initializePlatforms;
    private setupWeb;
    private setupDesktop;
    private setupMobile;
    private setupCLI;
    getMetadata(): ProjectMetadata | null;
    getConfig(): BuilderConfig;
}
//# sourceMappingURL=builder.d.ts.map