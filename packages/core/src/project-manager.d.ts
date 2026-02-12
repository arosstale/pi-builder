import type { ProjectMetadata } from './types';
export declare class ProjectManager {
    private projects;
    createProject(metadata: ProjectMetadata): void;
    getProject(id: string): ProjectMetadata | undefined;
    listProjects(): ProjectMetadata[];
    updateProject(id: string, updates: Partial<ProjectMetadata>): void;
    deleteProject(id: string): void;
}
//# sourceMappingURL=project-manager.d.ts.map