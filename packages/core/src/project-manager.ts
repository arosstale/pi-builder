import type { ProjectMetadata } from './types'

export class ProjectManager {
  private projects: Map<string, ProjectMetadata> = new Map()

  createProject(metadata: ProjectMetadata): void {
    if (this.projects.has(metadata.id)) {
      throw new Error(`Project ${metadata.id} already exists`)
    }
    this.projects.set(metadata.id, metadata)
  }

  getProject(id: string): ProjectMetadata | undefined {
    return this.projects.get(id)
  }

  listProjects(): ProjectMetadata[] {
    return Array.from(this.projects.values())
  }

  updateProject(id: string, updates: Partial<ProjectMetadata>): void {
    const project = this.projects.get(id)
    if (!project) {
      throw new Error(`Project ${id} not found`)
    }
    this.projects.set(id, { ...project, ...updates, updatedAt: new Date() })
  }

  deleteProject(id: string): void {
    if (!this.projects.delete(id)) {
      throw new Error(`Project ${id} not found`)
    }
  }
}
