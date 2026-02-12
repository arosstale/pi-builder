# Phase 5: Agent Orchestration Quick Start
## Pi Builder v1.2 - Agent Teams Implementation

**Status:** Foundation Complete ✅  
**Tests:** 20/20 Passing  
**Timeline:** Weeks 1-4 in progress

---

## What's New in Phase 5

Pi Builder now has **first-class agent support**. The agent orchestration system enables:

- **Multi-agent collaboration** - Multiple AI models working together
- **Intelligent routing** - Smart task allocation to best agent
- **Learning system** - Agents learn from decisions and outcomes
- **Pattern detection** - Automatic identification of optimizations
- **Cost optimization** - Suggestions for cost reduction

---

## Quick Start: 5 Minutes

### 1. Create Agents

```typescript
import { BaseAgent, type Task, type TaskResult, type AgentConfig } from '@pi-builder/core'

// Create a custom agent
class MyAgent extends BaseAgent {
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()
    
    try {
      // Your logic here
      const result = await processTask(task.input)
      return {
        success: true,
        data: result,
        latency: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        latency: Date.now() - startTime
      }
    }
  }
}

// Or use built-in configuration
const config: AgentConfig = {
  id: 'my-agent-1',
  type: 'custom',
  name: 'My Agent',
  version: '1.0.0',
  enabled: true,
  capabilities: ['analysis', 'text-generation']
}

const agent = new MyAgent(config)
```

### 2. Set Up Orchestrator

```typescript
import { AgentOrchestrator } from '@pi-builder/core'

// Create orchestrator with preferred strategy
const orchestrator = new AgentOrchestrator({
  name: 'Main Orchestrator',
  strategy: 'capability', // or 'latency', 'cost', 'failover', 'consensus'
  enableMetrics: true,
  enableLogging: true
})

// Register agents
orchestrator.registerAgent(agent1)
orchestrator.registerAgent(agent2)
orchestrator.registerAgent(agent3)
```

### 3. Execute Tasks

```typescript
// Single agent execution - smart routing
const task: Task = {
  id: 'task-1',
  type: 'analysis',
  priority: 'high',
  input: 'Analyze this data...',
  createdAt: new Date()
}

const result = await orchestrator.execute(task)
console.log(result.data) // Result from best agent
```

### 4. Multi-Agent Collaboration

```typescript
// Have multiple agents work on same task and aggregate results
const aggregated = await orchestrator.collaborate(task, [
  'agent-1',
  'agent-2',
  'agent-3'
])

console.log(aggregated.bestResult)  // Best result
console.log(aggregated.consensus)   // Did they agree?
console.log(aggregated.votes)       // How many voted each way?
```

### 5. Learn and Optimize

```typescript
import { AgentMemory } from '@pi-builder/core'

const memory = new AgentMemory()

// Record decisions
await memory.recordDecision(
  agent.id,
  task,
  { decision: 'use_model_x' },
  result,
  { feedback: 'good result' }
)

// Analyze patterns
const patterns = await memory.analyzePatterns()
console.log('Patterns found:', patterns)

// Get optimization suggestions
const optimizations = memory.suggestOptimizations()
console.log('Suggestions:', optimizations)
```

---

## 5 Routing Strategies

### 1. Capability-Based (Default)

Routes to agents that have the required capability.

```typescript
const orchestrator = new AgentOrchestrator({
  strategy: 'capability'
})

// Finds all agents with 'analysis' capability
```

**Best for:** Task types that map to specific capabilities

### 2. Latency-Based

Routes to agent with lowest average latency.

```typescript
const orchestrator = new AgentOrchestrator({
  strategy: 'latency'
})

// Selects fastest agent based on recent performance
```

**Best for:** Real-time applications, user-facing requests

### 3. Cost-Based

Routes to cheapest agent (by historical cost data).

```typescript
const orchestrator = new AgentOrchestrator({
  strategy: 'cost'
})

// Minimizes API costs
```

**Best for:** Cost-sensitive workloads, batch processing

### 4. Failover

Uses primary agent, has backups ready.

```typescript
const orchestrator = new AgentOrchestrator({
  strategy: 'failover'
})

// If primary fails, automatically tries secondary
```

**Best for:** High availability, mission-critical tasks

### 5. Consensus

Uses 3+ agents and aggregates results.

```typescript
const orchestrator = new AgentOrchestrator({
  strategy: 'consensus'
})

// Gets multiple perspectives, votes on best answer
```

**Best for:** Important decisions, hallucination prevention

---

## API Reference

### Task Interface

```typescript
interface Task {
  id: string                    // Unique task identifier
  type: string                  // Task type (e.g., 'analysis')
  priority: 'low' | 'medium' | 'high' | 'critical'
  input: unknown                // Task input data
  metadata?: Record<string, any>
  timeout?: number              // Timeout in milliseconds
  retryCount?: number           // Max retries if fails
  createdAt: Date
}
```

### TaskResult Interface

```typescript
interface TaskResult {
  success: boolean
  data?: unknown                // The result
  error?: Error
  latency: number               // Execution time in ms
  cost?: number                 // Cost in dollars
  metadata?: Record<string, any>
}
```

### Orchestrator Methods

```typescript
// Registration
orchestrator.registerAgent(agent)
orchestrator.deregisterAgent(agentId)
orchestrator.getAgents()
orchestrator.getAgent(agentId)

// Finding
orchestrator.findCapableAgents(capability)

// Execution
await orchestrator.execute(task)
await orchestrator.collaborate(task, agentIds?)

// Routing
await orchestrator.routeTask(task)

// Metrics
orchestrator.getMetrics()
orchestrator.resetMetrics()
await orchestrator.getHealth()
```

### Memory Methods

```typescript
// Recording
await memory.recordDecision(agentId, task, decision, result, feedback?)

// Querying
memory.query(criteria)
memory.getByAgent(agentId)
memory.getByTask(taskId)
memory.getSuccessful()
memory.getFailed()

// Analysis
await memory.analyzePatterns()
memory.getPatterns()
memory.suggestOptimizations()

// Admin
memory.tagEntries(query, tags)
memory.getAnalytics()
memory.export()
memory.clear()
```

---

## Real-World Example: API Development

```typescript
import { 
  BaseAgent, 
  AgentOrchestrator, 
  AgentMemory,
  type Task, 
  type TaskResult 
} from '@pi-builder/core'

// Agent 1: Design - Plans API schema
class DesignAgent extends BaseAgent {
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()
    const design = await designAPI(task.input)
    return {
      success: true,
      data: design,
      latency: Date.now() - startTime,
      cost: 0.005
    }
  }
}

// Agent 2: Code - Generates implementation
class CodeAgent extends BaseAgent {
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()
    const code = await generateCode(task.input)
    return {
      success: true,
      data: code,
      latency: Date.now() - startTime,
      cost: 0.01
    }
  }
}

// Agent 3: Test - Generates tests
class TestAgent extends BaseAgent {
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()
    const tests = await generateTests(task.input)
    return {
      success: true,
      data: tests,
      latency: Date.now() - startTime,
      cost: 0.008
    }
  }
}

// Orchestrate
const orchestrator = new AgentOrchestrator({
  name: 'API Builder',
  strategy: 'capability',
  enableMetrics: true
})

orchestrator.registerAgent(new DesignAgent({
  id: 'design',
  type: 'custom',
  name: 'Design Agent',
  version: '1.0.0',
  enabled: true,
  capabilities: ['design']
}))

orchestrator.registerAgent(new CodeAgent({
  id: 'code',
  type: 'custom',
  name: 'Code Agent',
  version: '1.0.0',
  enabled: true,
  capabilities: ['code-generation']
}))

orchestrator.registerAgent(new TestAgent({
  id: 'test',
  type: 'custom',
  name: 'Test Agent',
  version: '1.0.0',
  enabled: true,
  capabilities: ['testing']
}))

// Execute workflow
const task: Task = {
  id: 'api-1',
  type: 'api-development',
  priority: 'high',
  input: 'Create user management API',
  createdAt: new Date()
}

// Collaborate - all agents work together
const result = await orchestrator.collaborate(task)

console.log('Design:', result.results.get('design'))
console.log('Code:', result.results.get('code'))
console.log('Tests:', result.results.get('test'))

// Learn from it
const memory = new AgentMemory()
await memory.recordDecision(
  'orchestrator',
  task,
  { workflow: 'parallel' },
  {
    success: true,
    data: result,
    latency: result.executionTime
  }
)

// Get optimizations
const suggestions = memory.suggestOptimizations()
console.log('Improvements:', suggestions)
```

---

## Performance Tips

### 1. Use Capability Routing for Speed

```typescript
// ✅ Fast: O(1) lookup
const orchestrator = new AgentOrchestrator({
  strategy: 'capability'
})

// ❌ Slow: O(n) comparison
const orchestrator = new AgentOrchestrator({
  strategy: 'latency'
})
```

### 2. Cache Health Data

```typescript
// Get health once, use for multiple decisions
const health = await agent.getHealth()
if (health.errorRate < 0.1) {
  // Use this agent
}
```

### 3. Use Consensus Carefully

```typescript
// ✅ Good: For important decisions
await orchestrator.collaborate(task, ['agent-1', 'agent-2', 'agent-3'])

// ❌ Expensive: For every task
```

### 4. Batch Record Decisions

```typescript
// ✅ Efficient: Batch recording
for (const task of tasks) {
  const result = await orchestrator.execute(task)
  // Record later in batch
}

memory.recordDecision(/* batch */)

// ❌ Slower: Record each one
```

---

## Testing Agents

```typescript
import { describe, it, expect } from 'vitest'
import { BaseAgent, type AgentConfig, type Task } from '@pi-builder/core'

class TestAgent extends BaseAgent {
  async execute(task: Task) {
    return {
      success: true,
      data: task.input,
      latency: 10
    }
  }
}

describe('MyAgent', () => {
  it('should execute task', async () => {
    const config: AgentConfig = {
      id: 'test-agent',
      type: 'custom',
      name: 'Test',
      version: '1.0.0',
      enabled: true,
      capabilities: ['test']
    }

    const agent = new TestAgent(config)
    const task: Task = {
      id: 'task-1',
      type: 'test',
      priority: 'high',
      input: 'test',
      createdAt: new Date()
    }

    const result = await agent.execute(task)
    expect(result.success).toBe(true)
  })
})
```

---

## Next Steps

1. **Create your first agent** (5 minutes)
2. **Test with single task** (5 minutes)
3. **Set up orchestrator** (5 minutes)
4. **Try multi-agent collaboration** (5 minutes)
5. **Implement learning loop** (10 minutes)

---

## Troubleshooting

### No agents found
```typescript
// ❌ Problem
const capable = orchestrator.findCapableAgents('missing')

// ✅ Solution
// Register agents with required capability
agent.capabilities.includes('missing') // Should be true
```

### Task always fails
```typescript
// ❌ Problem
await orchestrator.execute(task) // Always fails

// ✅ Solution
// Check agent health
const health = await agent.getHealth()
console.log(health.errorRate) // Too high?

// Check timeout
task.timeout = 60000 // Increase if needed
```

### Memory growing too large
```typescript
// ❌ Problem
memory.export().entries.length // Huge!

// ✅ Solution
memory.clear() // Reset if needed
// Or: AgentMemory auto-cleans at 10,000 entries
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/agents/agent.ts` | Core Agent interface & BaseAgent |
| `src/agents/orchestrator.ts` | AgentOrchestrator routing engine |
| `src/agents/agent-memory.ts` | Memory & learning system |
| `src/agents/provider-adapter.ts` | Wrap v1.1 providers as agents |
| `src/agents/logger.ts` | Agent logging utilities |
| `__tests__/agent-orchestration.test.ts` | Test suite (20 tests) |

---

## What's Coming

**Week 2:** Provider integration & advanced routing  
**Week 3:** Agent specialization & custom SDK  
**Week 4:** Failover policies & circuit breakers  

**Phase 6:** Advanced Optimization (weeks 5-8)  
**Phase 7:** Enterprise Features (weeks 9-12)  

---

## Support

Questions? Check the docs:
- [PHASE_5_ADVANCED_FEATURES.md](./PHASE_5_ADVANCED_FEATURES.md) - Detailed feature roadmap
- [V1_2_ARCHITECTURE_INTEGRATION.md](./V1_2_ARCHITECTURE_INTEGRATION.md) - Architecture overview
- [agent-orchestration.test.ts](./packages/core/__tests__/agent-orchestration.test.ts) - Example usage

---

**Last Updated:** February 12, 2025  
**Phase 5 Status:** Foundation Complete ✅  
**Next Milestone:** Provider Integration (Week 2)

