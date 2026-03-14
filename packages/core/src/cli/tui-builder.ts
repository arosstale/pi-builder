import { EventEmitter } from 'events'

export interface TUIComponent {
  id: string
  type: 'text' | 'input' | 'menu' | 'progress' | 'table' | 'spinner'
  content: unknown
  style?: Record<string, string>
}

export interface TUILayout {
  width: number
  height: number
  components: TUIComponent[]
}

export class TUIBuilder extends EventEmitter {
  private components: Map<string, TUIComponent>
  private layout: TUILayout
  private activeComponent: string | null

  constructor(width: number = 80, height: number = 24) {
    super()
    this.components = new Map()
    this.layout = {
      width,
      height,
      components: [],
    }
    this.activeComponent = null
  }

  addComponent(component: TUIComponent): void {
    this.components.set(component.id, component)
    this.layout.components.push(component)
    this.emit('component:added', component.id)
  }

  removeComponent(id: string): void {
    this.components.delete(id)
    this.layout.components = this.layout.components.filter((c) => c.id !== id)
    this.emit('component:removed', id)
  }

  updateComponent(id: string, updates: Partial<TUIComponent>): void {
    const component = this.components.get(id)
    if (!component) return

    const updated = { ...component, ...updates }
    this.components.set(id, updated)

    const index = this.layout.components.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.layout.components[index] = updated
    }

    this.emit('component:updated', { id, updates })
  }

  text(id: string, content: string, style?: Record<string, string>): void {
    this.addComponent({
      id,
      type: 'text',
      content,
      style,
    })
  }

  input(id: string, prompt: string, style?: Record<string, string>): void {
    this.addComponent({
      id,
      type: 'input',
      content: prompt,
      style,
    })
  }

  menu(id: string, items: string[], style?: Record<string, string>): void {
    this.addComponent({
      id,
      type: 'menu',
      content: items,
      style,
    })
  }

  progress(id: string, current: number, total: number, style?: Record<string, string>): void {
    this.addComponent({
      id,
      type: 'progress',
      content: { current, total },
      style,
    })
  }

  table(id: string, rows: unknown[][], style?: Record<string, string>): void {
    this.addComponent({
      id,
      type: 'table',
      content: rows,
      style,
    })
  }

  spinner(id: string, message: string, style?: Record<string, string>): void {
    this.addComponent({
      id,
      type: 'spinner',
      content: message,
      style,
    })
  }

  setActive(id: string): void {
    if (!this.components.has(id)) return
    this.activeComponent = id
    this.emit('component:activated', id)
  }

  getActive(): string | null {
    return this.activeComponent
  }

  render(): string {
    let output = ''

    // Clear screen (ANSI code)
    output += '\x1Bc'

    // Render each component
    this.layout.components.forEach((component) => {
      const isActive = component.id === this.activeComponent
      const prefix = isActive ? '❯ ' : '  '

      switch (component.type) {
        case 'text':
          output += `${prefix}${component.content}\n`
          break
        case 'input':
          output += `${prefix}${component.content} > `
          break
        case 'menu':
          if (Array.isArray(component.content)) {
            component.content.forEach((item) => {
              output += `${prefix}${item}\n`
            })
          }
          break
        case 'progress':
          if (typeof component.content === 'object' && component.content !== null) {
            const { current, total } = component.content as Record<string, number>
            const percent = Math.round((current / total) * 100)
            const bar = '█'.repeat(percent / 5) + '░'.repeat(20 - percent / 5)
            output += `${prefix}[${bar}] ${percent}%\n`
          }
          break
        case 'spinner':
          output += `${prefix}⟳ ${component.content}\n`
          break
        case 'table':
          if (Array.isArray(component.content)) {
            component.content.forEach((row) => {
              output += `${prefix}${row.join('\t')}\n`
            })
          }
          break
      }
    })

    return output
  }

  clear(): void {
    this.components.clear()
    this.layout.components = []
    this.activeComponent = null
    this.emit('layout:cleared')
  }

  getLayout(): TUILayout {
    return this.layout
  }

  setSize(width: number, height: number): void {
    this.layout.width = width
    this.layout.height = height
    this.emit('layout:resized', { width, height })
  }
}
