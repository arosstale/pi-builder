import { describe, it, expect, beforeEach } from 'vitest'
import { ProjectManager } from '../src/project-manager'
import type { ProjectMetadata } from '../src/types'

describe('ProjectManager', () => {
  let manager: ProjectManager
  let testProject: ProjectMetadata

  beforeEach(() => {
    manager = new ProjectManager()
    testProject = {
      id: 'proj_1',
      name: 'test-project',
      description: 'Test project',
      version: '0.1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      platforms: ['web', 'cli'],
    }
  })

  it('should create manager instance', () => {
    expect(manager).toBeDefined()
  })

  it('should create a project', () => {
    manager.createProject(testProject)
    const project = manager.getProject('proj_1')

    expect(project).toBeDefined()
    expect(project?.name).toBe('test-project')
  })

  it('should list projects', () => {
    manager.createProject(testProject)

    const project2 = { ...testProject, id: 'proj_2', name: 'project-2' }
    manager.createProject(project2)

    const projects = manager.listProjects()
    expect(projects).toHaveLength(2)
  })

  it('should update project', () => {
    manager.createProject(testProject)
    manager.updateProject('proj_1', { description: 'Updated description' })

    const project = manager.getProject('proj_1')
    expect(project?.description).toBe('Updated description')
  })

  it('should delete project', () => {
    manager.createProject(testProject)
    manager.deleteProject('proj_1')

    const project = manager.getProject('proj_1')
    expect(project).toBeUndefined()
  })

  it('should throw on duplicate project', () => {
    manager.createProject(testProject)

    expect(() => {
      manager.createProject(testProject)
    }).toThrow()
  })

  it('should throw on update non-existent project', () => {
    expect(() => {
      manager.updateProject('nonexistent', { name: 'test' })
    }).toThrow()
  })

  it('should throw on delete non-existent project', () => {
    expect(() => {
      manager.deleteProject('nonexistent')
    }).toThrow()
  })

  it('should update timestamps on project update', () => {
    manager.createProject(testProject)
    const originalTime = manager.getProject('proj_1')?.updatedAt

    // Small delay to ensure timestamp differs
    setTimeout(() => {
      manager.updateProject('proj_1', { description: 'new' })
      const newTime = manager.getProject('proj_1')?.updatedAt

      expect(newTime?.getTime()).toBeGreaterThan(originalTime?.getTime() || 0)
    }, 10)
  })
})
