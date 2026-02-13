export type HookEventType =
  | 'SessionStart'
  | 'SessionEnd'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'PermissionRequest'
  | 'Notification'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Stop'
  | 'PreCompact'

export interface HookEvent {
  id: string
  type: HookEventType
  sessionId: string
  timestamp: Date
  sourceApp: string
  model: string
  agentId?: string
  subagentId?: string
  toolName?: string
  payload: Record<string, any>
  metadata: {
    duration?: number
    status?: 'success' | 'failure'
    errorMessage?: string
  }
}

export interface HookEventStore {
  events: HookEvent[]
  sessionMap: Map<string, HookEvent[]>
  agentMap: Map<string, HookEvent[]>
}

export class HookEventCapture {
  private eventStore: HookEventStore = {
    events: [],
    sessionMap: new Map(),
    agentMap: new Map()
  }

  private webhookSubscribers: Map<HookEventType, Function[]> = new Map()

  constructor() {
    this.initializeSubscribers()
  }

  private initializeSubscribers(): void {
    const eventTypes: HookEventType[] = [
      'SessionStart',
      'SessionEnd',
      'UserPromptSubmit',
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'PermissionRequest',
      'Notification',
      'SubagentStart',
      'SubagentStop',
      'Stop',
      'PreCompact'
    ]

    for (const eventType of eventTypes) {
      this.webhookSubscribers.set(eventType, [])
    }
  }

  /**
   * SessionStart Hook - Agent session begins
   */
  async onSessionStart(sessionId: string, sourceApp: string, model: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('SessionStart', sessionId, sourceApp, model, payload)
    console.log(`🟢 SessionStart: ${sessionId}`)
    return this.storeAndNotify(event)
  }

  /**
   * SessionEnd Hook - Agent session completes
   */
  async onSessionEnd(sessionId: string, sourceApp: string, model: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('SessionEnd', sessionId, sourceApp, model, payload)
    console.log(`🔴 SessionEnd: ${sessionId}`)
    return this.storeAndNotify(event)
  }

  /**
   * UserPromptSubmit Hook - User input received
   */
  async onUserPromptSubmit(sessionId: string, sourceApp: string, model: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('UserPromptSubmit', sessionId, sourceApp, model, payload)
    console.log(`💬 UserPromptSubmit: ${sessionId}`)
    return this.storeAndNotify(event)
  }

  /**
   * PreToolUse Hook - Before tool execution
   */
  async onPreToolUse(sessionId: string, sourceApp: string, model: string, toolName: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('PreToolUse', sessionId, sourceApp, model, payload)
    event.toolName = toolName
    console.log(`🔧 PreToolUse: ${toolName}`)
    return this.storeAndNotify(event)
  }

  /**
   * PostToolUse Hook - After tool execution
   */
  async onPostToolUse(sessionId: string, sourceApp: string, model: string, toolName: string, duration: number, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('PostToolUse', sessionId, sourceApp, model, payload)
    event.toolName = toolName
    event.metadata.duration = duration
    event.metadata.status = 'success'
    console.log(`✅ PostToolUse: ${toolName} (${duration}ms)`)
    return this.storeAndNotify(event)
  }

  /**
   * PostToolUseFailure Hook - Tool failed
   */
  async onPostToolUseFailure(sessionId: string, sourceApp: string, model: string, toolName: string, error: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('PostToolUseFailure', sessionId, sourceApp, model, payload)
    event.toolName = toolName
    event.metadata.status = 'failure'
    event.metadata.errorMessage = error
    console.log(`❌ PostToolUseFailure: ${toolName} - ${error}`)
    return this.storeAndNotify(event)
  }

  /**
   * PermissionRequest Hook - Agent requests permission
   */
  async onPermissionRequest(sessionId: string, sourceApp: string, model: string, permission: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('PermissionRequest', sessionId, sourceApp, model, payload)
    event.payload.permission = permission
    console.log(`🔐 PermissionRequest: ${permission}`)
    return this.storeAndNotify(event)
  }

  /**
   * Notification Hook - Agent notification
   */
  async onNotification(sessionId: string, sourceApp: string, model: string, message: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('Notification', sessionId, sourceApp, model, payload)
    event.payload.message = message
    console.log(`📢 Notification: ${message}`)
    return this.storeAndNotify(event)
  }

  /**
   * SubagentStart Hook - Sub-agent initialized
   */
  async onSubagentStart(sessionId: string, sourceApp: string, model: string, subagentId: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('SubagentStart', sessionId, sourceApp, model, payload)
    event.subagentId = subagentId
    console.log(`👶 SubagentStart: ${subagentId}`)
    return this.storeAndNotify(event)
  }

  /**
   * SubagentStop Hook - Sub-agent stopped
   */
  async onSubagentStop(sessionId: string, sourceApp: string, model: string, subagentId: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('SubagentStop', sessionId, sourceApp, model, payload)
    event.subagentId = subagentId
    console.log(`🛑 SubagentStop: ${subagentId}`)
    return this.storeAndNotify(event)
  }

  /**
   * Stop Hook - Session stopped
   */
  async onStop(sessionId: string, sourceApp: string, model: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('Stop', sessionId, sourceApp, model, payload)
    console.log(`⏹️ Stop: ${sessionId}`)
    return this.storeAndNotify(event)
  }

  /**
   * PreCompact Hook - Context compression
   */
  async onPreCompact(sessionId: string, sourceApp: string, model: string, payload: Record<string, any>): Promise<HookEvent> {
    const event = this.createHookEvent('PreCompact', sessionId, sourceApp, model, payload)
    console.log(`📦 PreCompact: ${sessionId}`)
    return this.storeAndNotify(event)
  }

  /**
   * Create hook event
   */
  private createHookEvent(type: HookEventType, sessionId: string, sourceApp: string, model: string, payload: Record<string, any>): HookEvent {
    return {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      sessionId,
      timestamp: new Date(),
      sourceApp,
      model,
      payload,
      metadata: {}
    }
  }

  /**
   * Store and notify
   */
  private storeAndNotify(event: HookEvent): HookEvent {
    // Store in global events
    this.eventStore.events.push(event)

    // Store in session map
    if (!this.eventStore.sessionMap.has(event.sessionId)) {
      this.eventStore.sessionMap.set(event.sessionId, [])
    }
    this.eventStore.sessionMap.get(event.sessionId)!.push(event)

    // Store in agent map
    if (event.agentId) {
      if (!this.eventStore.agentMap.has(event.agentId)) {
        this.eventStore.agentMap.set(event.agentId, [])
      }
      this.eventStore.agentMap.get(event.agentId)!.push(event)
    }

    // Notify subscribers
    const subscribers = this.webhookSubscribers.get(event.type) || []
    for (const subscriber of subscribers) {
      subscriber(event)
    }

    return event
  }

  /**
   * Subscribe to hook events
   */
  subscribe(eventType: HookEventType, callback: (event: HookEvent) => void): void {
    const subscribers = this.webhookSubscribers.get(eventType) || []
    subscribers.push(callback)
    this.webhookSubscribers.set(eventType, subscribers)
  }

  /**
   * Get events by session
   */
  getSessionEvents(sessionId: string): HookEvent[] {
    return this.eventStore.sessionMap.get(sessionId) || []
  }

  /**
   * Get events by agent
   */
  getAgentEvents(agentId: string): HookEvent[] {
    return this.eventStore.agentMap.get(agentId) || []
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: HookEventType): HookEvent[] {
    return this.eventStore.events.filter((e) => e.type === eventType)
  }

  /**
   * Get all events
   */
  getAllEvents(): HookEvent[] {
    return this.eventStore.events
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.eventStore.events.length
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): {
    sessionId: string
    eventCount: number
    eventTypes: Record<HookEventType, number>
    duration: number
    startTime: Date
    endTime?: Date
  } {
    const events = this.getSessionEvents(sessionId)
    const eventTypes: Record<HookEventType, number> = {
      SessionStart: 0,
      SessionEnd: 0,
      UserPromptSubmit: 0,
      PreToolUse: 0,
      PostToolUse: 0,
      PostToolUseFailure: 0,
      PermissionRequest: 0,
      Notification: 0,
      SubagentStart: 0,
      SubagentStop: 0,
      Stop: 0,
      PreCompact: 0
    }

    for (const event of events) {
      eventTypes[event.type]++
    }

    const startTime = events.length > 0 ? events[0].timestamp : new Date()
    const endTime = events.length > 0 ? events[events.length - 1].timestamp : undefined
    const duration = endTime ? endTime.getTime() - startTime.getTime() : 0

    return {
      sessionId,
      eventCount: events.length,
      eventTypes,
      duration,
      startTime,
      endTime
    }
  }

  /**
   * Clear old events
   */
  clearOldEvents(daysOld: number): number {
    const threshold = Date.now() - daysOld * 24 * 60 * 60 * 1000
    const beforeCount = this.eventStore.events.length

    this.eventStore.events = this.eventStore.events.filter((e) => e.timestamp.getTime() > threshold)

    return beforeCount - this.eventStore.events.length
  }
}
