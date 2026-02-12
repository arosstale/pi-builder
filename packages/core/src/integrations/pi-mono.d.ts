/**
 * Pi-Mono Integration
 * Integrates with Pi Mono for enhanced automation
 */
import type { Builder } from '../builder';
export interface PiMonoConfig {
    apiUrl?: string;
    token?: string;
    timeout?: number;
}
export declare class PiMonoIntegration {
    private apiUrl;
    constructor(config?: PiMonoConfig);
    syncWithPiMono(builder: Builder): Promise<void>;
    triggerWorkflow(workflowId: string, data: Record<string, unknown>): Promise<void>;
    getWorkflowStatus(executionId: string): Promise<Record<string, unknown>>;
    private sendToAPI;
    setApiUrl(url: string): void;
}
//# sourceMappingURL=pi-mono.d.ts.map