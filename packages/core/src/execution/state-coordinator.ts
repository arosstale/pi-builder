import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * STATE.yaml Decentralized Coordination
 * Removes orchestrator bottleneck - agents coordinate via shared state file
 */

export interface ProjectTask {
  id: string
  status: 'pending' | 'in_progress' | 'blocked' | 'done' | 'failed'
  owner?: string
  assignee?: string
  startedAt?: Date
  completedAt?: Date
  blockedBy?: string
  output?: string
  notes?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  estimatedHours?: number
  actualHours?: number
}

export interface ProjectState {
  projectId: string
  projectName: string
  version: number
  updated: Date
  tasks: ProjectTask[]
  nextActions: string[]
  blockers: string[]
  metrics: {
    totalTasks: number
    completedTasks: number
    blockedTasks: number
    completionPercentage: number
    burndownRate: number
  }
}

export class StateCoordinator {
  private stateDir: string
  private gitEnabled: boolean

  constructor(stateDir: string = './project-state', gitEnabled: boolean = true) {
    this.stateDir = stateDir
    this.gitEnabled = gitEnabled

    // Ensure state directory exists
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true })
    }
  }

  /**
   * Initialize project state
   */
  async initializeProject(
    projectId: string,
    projectName: string,
    tasks: ProjectTask[]
  ): Promise<ProjectState> {
    const state: ProjectState = {
      projectId,
      projectName,
      version: 1,
      updated: new Date(),
      tasks,
      nextActions: [],
      blockers: [],
      metrics: {
        totalTasks: tasks.length,
        completedTasks: 0,
        blockedTasks: 0,
        completionPercentage: 0,
        burndownRate: 0
      }
    }

    await this.saveState(projectId, state)
    console.log(`✅ Project initialized: ${projectName}`)

    return state
  }

  /**
   * Load project state from file
   */
  async loadState(projectId: string): Promise<ProjectState | null> {
    const filePath = path.join(this.stateDir, `${projectId}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const state = JSON.parse(content)

      // Parse dates
      state.updated = new Date(state.updated)
      state.tasks.forEach((task: ProjectTask) => {
        if (task.startedAt) task.startedAt = new Date(task.startedAt)
        if (task.completedAt) task.completedAt = new Date(task.completedAt)
      })

      return state
    } catch (error) {
      console.error(`Failed to load state for ${projectId}:`, error)
      return null
    }
  }

  /**
   * Save project state to file
   */
  async saveState(projectId: string, state: ProjectState): Promise<void> {
    const filePath = path.join(this.stateDir, `${projectId}.json`)

    try {
      // Update metrics
      const completed = state.tasks.filter((t) => t.status === 'done').length
      const blocked = state.tasks.filter((t) => t.status === 'blocked').length

      state.metrics = {
        totalTasks: state.tasks.length,
        completedTasks: completed,
        blockedTasks: blocked,
        completionPercentage: state.tasks.length > 0 ? (completed / state.tasks.length) * 100 : 0,
        burndownRate: state.tasks.length > 0 ? completed / state.tasks.length : 0
      }

      state.version++
      state.updated = new Date()

      fs.writeFileSync(filePath, JSON.stringify(state, null, 2))

      // Commit to git if enabled
      if (this.gitEnabled) {
        await this.commitState(projectId)
      }
    } catch (error) {
      console.error(`Failed to save state for ${projectId}:`, error)
    }
  }

  /**
   * Update task status
   */
  async updateTask(projectId: string, taskId: string, updates: Partial<ProjectTask>): Promise<ProjectTask | null> {
    const state = await this.loadState(projectId)
    if (!state) return null

    const task = state.tasks.find((t) => t.id === taskId)
    if (!task) return null

    // Update task
    Object.assign(task, updates)

    if (updates.status === 'done') {
      task.completedAt = new Date()
    }

    if (updates.status === 'in_progress' && !task.startedAt) {
      task.startedAt = new Date()
    }

    // Update state
    await this.saveState(projectId, state)

    console.log(`✅ Updated task ${taskId}: ${task.status}`)

    return task
  }

  /**
   * Get pending tasks for agent
   */
  async getPendingTasks(projectId: string, assignee?: string): Promise<ProjectTask[]> {
    const state = await this.loadState(projectId)
    if (!state) return []

    let tasks = state.tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress')

    if (assignee) {
      tasks = tasks.filter((t) => t.assignee === assignee)
    }

    // Filter out blocked tasks
    tasks = tasks.filter((t) => !t.blockedBy || state.tasks.find((bt) => bt.id === t.blockedBy)?.status === 'done')

    return tasks.sort((a, b) => {
      const priorityMap = { critical: 0, high: 1, normal: 2, low: 3 }
      return (priorityMap[a.priority || 'normal'] || 2) - (priorityMap[b.priority || 'normal'] || 2)
    })
  }

  /**
   * Claim task for agent
   */
  async claimTask(projectId: string, taskId: string, agentId: string): Promise<boolean> {
    const state = await this.loadState(projectId)
    if (!state) return false

    const task = state.tasks.find((t) => t.id === taskId)
    if (!task) return false

    task.owner = agentId
    task.assignee = agentId
    task.status = 'in_progress'
    task.startedAt = new Date()

    await this.saveState(projectId, state)

    console.log(`✅ Agent ${agentId} claimed task ${taskId}`)

    return true
  }

  /**
   * Complete task and update dependents
   */
  async completeTask(projectId: string, taskId: string, output?: string): Promise<boolean> {
    const state = await this.loadState(projectId)
    if (!state) return false

    const task = state.tasks.find((t) => t.id === taskId)
    if (!task) return false

    task.status = 'done'
    task.completedAt = new Date()
    if (output) task.output = output

    // Unblock dependent tasks
    const dependents = state.tasks.filter((t) => t.blockedBy === taskId)
    for (const dependent of dependents) {
      dependent.blockedBy = undefined
      dependent.status = 'pending'
    }

    await this.saveState(projectId, state)

    console.log(`✅ Task ${taskId} completed. Unblocked ${dependents.length} dependent tasks.`)

    return true
  }

  /**
   * Get project summary
   */
  async getProjectSummary(projectId: string): Promise<{
    projectName: string
    completionPercentage: number
    totalTasks: number
    completedTasks: number
    blockedTasks: number
    nextActions: string[]
    blockers: string[]
  } | null> {
    const state = await this.loadState(projectId)
    if (!state) return null

    return {
      projectName: state.projectName,
      completionPercentage: state.metrics.completionPercentage,
      totalTasks: state.metrics.totalTasks,
      completedTasks: state.metrics.completedTasks,
      blockedTasks: state.metrics.blockedTasks,
      nextActions: state.nextActions,
      blockers: state.blockers
    }
  }

  /**
   * Commit state to git
   */
  private async commitState(projectId: string): Promise<void> {
    try {
      const filePath = path.join(this.stateDir, `${projectId}.json`)
      const commitMessage = `Update project state: ${projectId} - ${new Date().toISOString()}`

      // Add and commit
      await execAsync(`git add "${filePath}"`)
      await execAsync(`git commit -m "${commitMessage}"`)

      console.log(`📝 State committed to git: ${projectId}`)
    } catch (error) {
      // Git might not be available, silently fail
    }
  }

  /**
   * Get state history from git
   */
  async getStateHistory(projectId: string, limit: number = 10): Promise<Array<{ hash: string; message: string; date: string }>> {
    if (!this.gitEnabled) return []

    try {
      const filePath = path.join(this.stateDir, `${projectId}.json`)
      const { stdout } = await execAsync(`git log --oneline -${limit} "${filePath}"`)

      return stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(' ')
          return {
            hash: parts[0],
            message: parts.slice(1).join(' '),
            date: new Date().toISOString()
          }
        })
    } catch (error) {
      return []
    }
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<ProjectState[]> {
    const files = fs.readdirSync(this.stateDir).filter((f) => f.endsWith('.json'))

    const projects: ProjectState[] = []

    for (const file of files) {
      const projectId = file.replace('.json', '')
      const state = await this.loadState(projectId)
      if (state) {
        projects.push(state)
      }
    }

    return projects
  }

  /**
   * Spawn agent for task
   */
  async spawnAgentForTask(projectId: string, taskId: string, agentType: string): Promise<string> {
    const agentId = `agent-${agentType}-${Date.now()}`

    // Claim task
    await this.claimTask(projectId, taskId, agentId)

    console.log(`🚀 Spawned ${agentType} agent: ${agentId}`)

    return agentId
  }

  /**
   * Multi-agent execution
   */
  async executeParallel(
    projectId: string,
    agentExecutor: (task: ProjectTask, agentId: string) => Promise<string>
  ): Promise<void> {
    const state = await this.loadState(projectId)
    if (!state) return

    console.log(`🤝 Starting parallel execution for ${state.projectName}`)

    const pendingTasks = state.tasks.filter((t) => t.status === 'pending')

    // Spawn agents for each pending task
    const agentPromises = pendingTasks.map(async (task) => {
      const agentId = `agent-${task.id}-${Date.now()}`

      await this.claimTask(projectId, task.id, agentId)

      try {
        const output = await agentExecutor(task, agentId)
        await this.completeTask(projectId, task.id, output)
      } catch (error) {
        console.error(`❌ Agent ${agentId} failed for task ${task.id}:`, error)
        await this.updateTask(projectId, task.id, { status: 'failed' })
      }
    })

    await Promise.all(agentPromises)

    console.log(`✅ Parallel execution complete`)
  }
}
