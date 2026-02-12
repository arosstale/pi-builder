/**
 * Pi Agent SDK Integration (PRIMARY)
 * Integration with @mariozechner/pi-agent-core
 * This is the PRIMARY integration for Pi Builder
 */
import type { CodeGenerationRequest } from '../types';
export interface PiAgentSDKConfig {
    sessionId?: string;
    steeringMode?: 'all' | 'one-at-a-time';
    followUpMode?: 'all' | 'one-at-a-time';
    maxRetryDelayMs?: number;
    getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
    thinkingBudgets?: Record<string, unknown>;
}
export interface AgentTask {
    id: string;
    prompt: string;
    context?: Record<string, unknown>;
    language?: string;
    framework?: string;
    state?: Record<string, unknown>;
}
export interface AgentTaskResult {
    taskId: string;
    code: string;
    language: string;
    explanation: string;
    state: Record<string, unknown>;
    metadata: {
        tokensUsed: number;
        completedAt: Date;
        model: string;
        sessionId?: string;
    };
}
/**
 * Pi Agent SDK Integration
 * PRIMARY integration for Pi Builder
 * Uses the actual @mariozechner/pi-agent-core structure
 */
export declare class PiAgentSDKIntegration {
    private sessionId?;
    private steeringMode;
    private followUpMode;
    private tasks;
    private agentState;
    constructor(config?: PiAgentSDKConfig);
    /**
     * Execute a task using the Pi Agent SDK
     * PRIMARY method for code generation
     */
    executeTask(request: CodeGenerationRequest): Promise<AgentTaskResult>;
    /**
     * Simulate the agent loop
     * In production, this would use actual @mariozechner/pi-agent-core
     */
    private executeAgentLoop;
    /**
     * Stream task execution for real-time updates
     */
    streamTask(request: CodeGenerationRequest): AsyncGenerator<string, AgentTaskResult>;
    /**
     * Get task status
     */
    getTaskStatus(taskId: string): AgentTask | undefined;
    /**
     * List all tasks
     */
    listTasks(): AgentTask[];
    /**
     * Update session ID (for session-based caching)
     */
    setSessionId(sessionId: string): void;
    /**
     * Get current session ID
     */
    getSessionId(): string | undefined;
    /**
     * Update agent state
     */
    setAgentState(state: Record<string, unknown>): void;
    /**
     * Get agent state
     */
    getAgentState(): Record<string, unknown>;
    /**
     * Clear task history
     */
    clearTasks(): void;
    private generateCodeTemplate;
}
//# sourceMappingURL=pi-agent-sdk.d.ts.map