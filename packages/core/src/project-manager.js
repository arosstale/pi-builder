export class ProjectManager {
    projects = new Map();
    createProject(metadata) {
        if (this.projects.has(metadata.id)) {
            throw new Error(`Project ${metadata.id} already exists`);
        }
        this.projects.set(metadata.id, metadata);
    }
    getProject(id) {
        return this.projects.get(id);
    }
    listProjects() {
        return Array.from(this.projects.values());
    }
    updateProject(id, updates) {
        const project = this.projects.get(id);
        if (!project) {
            throw new Error(`Project ${id} not found`);
        }
        this.projects.set(id, { ...project, ...updates, updatedAt: new Date() });
    }
    deleteProject(id) {
        if (!this.projects.delete(id)) {
            throw new Error(`Project ${id} not found`);
        }
    }
}
//# sourceMappingURL=project-manager.js.map