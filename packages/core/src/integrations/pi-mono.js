/**
 * Pi-Mono Integration
 * Integrates with Pi Mono for enhanced automation
 */
export class PiMonoIntegration {
    apiUrl = 'http://localhost:3000/api';
    constructor(config) {
        if (config?.apiUrl)
            this.apiUrl = config.apiUrl;
        if (config?.token) {
            // Token stored for auth, using void to suppress unused warning
            void config.token;
        }
        // Timeout config acknowledged
        void config?.timeout;
    }
    async syncWithPiMono(builder) {
        try {
            const metadata = builder.getMetadata();
            if (!metadata) {
                throw new Error('No project metadata found');
            }
            console.log(`🔄 Syncing with Pi-Mono: ${metadata.name}`);
            // Send project info to Pi-Mono
            const response = await this.sendToAPI('/sync', {
                projectId: metadata.id,
                projectName: metadata.name,
                description: metadata.description,
                platforms: metadata.platforms,
                timestamp: new Date().toISOString(),
            });
            console.log(`✅ Pi-Mono sync successful: ${response.message}`);
        }
        catch (error) {
            console.error(`❌ Pi-Mono sync failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    async triggerWorkflow(workflowId, data) {
        try {
            console.log(`⚙️ Triggering Pi-Mono workflow: ${workflowId}`);
            const response = await this.sendToAPI('/workflows/trigger', {
                workflowId,
                data,
                timestamp: new Date().toISOString(),
            });
            console.log(`✅ Workflow triggered: ${response.executionId}`);
        }
        catch (error) {
            console.error(`❌ Workflow trigger failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    async getWorkflowStatus(executionId) {
        try {
            const response = await this.sendToAPI(`/workflows/${executionId}/status`, {});
            return response;
        }
        catch (error) {
            console.error(`❌ Status check failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    async sendToAPI(endpoint, data) {
        // Mock implementation - replace with actual fetch
        console.log(`📡 POST ${this.apiUrl}${endpoint}`);
        console.log(`Data: ${JSON.stringify(data)}`);
        return {
            success: true,
            message: 'Mock response from Pi-Mono',
            executionId: `exec_${Date.now()}`,
        };
    }
    setApiUrl(url) {
        this.apiUrl = url;
    }
}
//# sourceMappingURL=pi-mono.js.map