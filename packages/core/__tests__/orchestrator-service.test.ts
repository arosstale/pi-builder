import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createOrchestratorService, OrchestratorService } from '../src/orchestration/orchestrator-service'
import type { ChatMessage } from '../src/orchestration/orchestrator-service'

describe('OrchestratorService', () => {
  let service: OrchestratorService

  afterEach(async () => {
    if (service) {
      await service.close()
    }
  })

  describe('createOrchestratorService', () => {
    it('should create instance with sessionId', async () => {
      service = await createOrchestratorService()
      
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(OrchestratorService)
      
      const sessionId = service.getSessionId()
      expect(sessionId).toBeDefined()
      expect(typeof sessionId).toBe('string')
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/)
    })
  })

  describe('getHistory', () => {
    beforeEach(async () => {
      service = await createOrchestratorService()
    })

    it('should return empty array initially', () => {
      const history = service.getHistory()
      
      expect(history).toBeDefined()
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBe(0)
    })
  })

  describe('clearHistory', () => {
    beforeEach(async () => {
      service = await createOrchestratorService()
    })

    it('should empty history', async () => {
      // Mock the orchestrator to avoid real CLI calls
      const mockProcessMessage = vi.spyOn(service as any, 'processMessage')
      mockProcessMessage.mockImplementation(async (userMessage: string) => {
        // Add user message to history directly
        const userChatMsg: ChatMessage = {
          id: `msg-${Date.now()}-test`,
          role: 'user',
          content: userMessage,
          timestamp: new Date(),
        }
        ;(service as any).history.push(userChatMsg)
        
        // Add assistant message
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-test2`,
          role: 'assistant',
          content: 'Mock response',
          timestamp: new Date(),
        }
        ;(service as any).history.push(assistantMsg)
        
        return {
          message: assistantMsg,
          agentResult: {
            agent: 'mock',
            status: 'success' as const,
            output: 'Mock response',
            durationMs: 0,
          },
        }
      })

      // Add some messages to history
      await service.processMessage('Test message 1')
      await service.processMessage('Test message 2')
      
      let history = service.getHistory()
      expect(history.length).toBeGreaterThan(0)
      
      // Clear history
      service.clearHistory()
      
      history = service.getHistory()
      expect(history.length).toBe(0)
      
      mockProcessMessage.mockRestore()
    })
  })

  describe('getSessionId', () => {
    it('should return stable string', async () => {
      service = await createOrchestratorService()
      
      const sessionId1 = service.getSessionId()
      const sessionId2 = service.getSessionId()
      const sessionId3 = service.getSessionId()
      
      expect(sessionId1).toBe(sessionId2)
      expect(sessionId2).toBe(sessionId3)
      expect(typeof sessionId1).toBe('string')
      expect(sessionId1.length).toBeGreaterThan(0)
    })

    it('should generate different sessionIds for different instances', async () => {
      service = await createOrchestratorService()
      const service2 = await createOrchestratorService()
      
      const sessionId1 = service.getSessionId()
      const sessionId2 = service2.getSessionId()
      
      expect(sessionId1).not.toBe(sessionId2)
      
      await service2.close()
    })
  })

  describe('EventEmitter', () => {
    beforeEach(async () => {
      service = await createOrchestratorService()
    })

    it('should emit user_message event on processMessage', async () => {
      const userMessages: ChatMessage[] = []
      
      service.on('user_message', (msg: ChatMessage) => {
        userMessages.push(msg)
      })
      
      // Mock the orchestrator to avoid real CLI calls
      const mockOrchestrator = {
        selectForTask: vi.fn().mockResolvedValue({
          id: 'mock-agent',
          executeStream: async function* () {
            yield 'Mock response'
          },
        }),
      }
      ;(service as any).wrapperOrchestrator = mockOrchestrator
      
      const testMessage = 'Test user message'
      await service.processMessage(testMessage)
      
      expect(userMessages.length).toBe(1)
      expect(userMessages[0].role).toBe('user')
      expect(userMessages[0].content).toBe(testMessage)
      expect(userMessages[0].id).toBeDefined()
      expect(userMessages[0].timestamp).toBeInstanceOf(Date)
    })
  })
})
