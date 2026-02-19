/**
 * RAG Knowledge Base
 * Retrieval-Augmented Generation with semantic search
 * Custom domain knowledge management
 */

export interface Document {
  id: string
  source: 'url' | 'tweet' | 'article' | 'file' | 'manual'
  title: string
  content: string
  url?: string
  metadata?: Record<string, any>
  timestamp: Date
  embedding?: number[]
}

export interface SearchResult {
  document: Document
  score: number
  relevance: 'high' | 'medium' | 'low'
}

export interface RAGQuery {
  question: string
  contextCount?: number
  threshold?: number
}

export interface RAGResponse {
  answer: string
  sources: Document[]
  confidence: number
  generatedAt: Date
}

/**
 * Embedding Service
 * Uses OpenRouter (text-embedding-3-small) when OPENROUTER_API_KEY is set,
 * falls back to a deterministic hash-based vector for offline/test use.
 */
export class EmbeddingService {
  private readonly dims = 1536 // text-embedding-3-small output dims

  async embed(text: string): Promise<number[]> {
    const orKey = process.env.OPENROUTER_API_KEY
    if (orKey && !process.env.VITEST) {
      return this.embedViaOpenRouter(text, orKey)
    }
    return this.hashEmbed(text)
  }

  private async embedViaOpenRouter(text: string, apiKey: string): Promise<number[]> {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/arosstale/pi-builder',
        'X-Title': 'pi-builder',
      },
      body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: text }),
    })

    if (!res.ok) {
      console.warn(`⚠️  Embedding API error ${res.status} — falling back to hash embedding`)
      return this.hashEmbed(text)
    }

    const data = (await res.json()) as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  }

  /** Deterministic hash-based fallback (no API key required) */
  private hashEmbed(text: string): number[] {
    const vector = new Array(this.dims).fill(0)
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      vector[i % vector.length] += Math.sin(charCode * (i + 1)) * 0.1
    }
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    return vector.map((v) => v / (norm || 1))
  }

  /**
   * Calculate cosine similarity
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }
}

/**
 * RAG Knowledge Base
 */
export class RAGKnowledgeBase {
  private documents: Document[] = []
  private embeddings: Map<string, number[]> = new Map()
  private embeddingService: EmbeddingService

  constructor() {
    this.embeddingService = new EmbeddingService()
  }

  /**
   * Add document from URL
   */
  async addFromUrl(url: string, title?: string): Promise<Document> {
    console.log(`📥 Fetching document from URL: ${url}`)

    // In production: fetch and parse the URL
    // const response = await fetch(url)
    // const html = await response.text()
    // const content = parseHtml(html)

    const content = `Content from ${url}`

    return this.addDocument({
      source: 'url',
      title: title || url,
      content,
      url
    })
  }

  /**
   * Add document from tweet
   */
  async addFromTweet(tweetId: string, content: string, author?: string): Promise<Document> {
    console.log(`🐦 Adding tweet: ${tweetId}`)

    return this.addDocument({
      source: 'tweet',
      title: `Tweet by ${author || 'Unknown'}: ${tweetId}`,
      content,
      metadata: { tweetId, author }
    })
  }

  /**
   * Add document from article
   */
  async addArticle(title: string, content: string, source?: string): Promise<Document> {
    console.log(`📄 Adding article: ${title}`)

    return this.addDocument({
      source: 'article',
      title,
      content,
      metadata: { source }
    })
  }

  /**
   * Add document manually
   */
  async addDocument(data: Partial<Document>): Promise<Document> {
    const document: Document = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source: data.source || 'manual',
      title: data.title || 'Untitled',
      content: data.content || '',
      url: data.url,
      metadata: data.metadata,
      timestamp: new Date()
    }

    // Generate embedding
    console.log(`🔗 Generating embedding for: ${document.title}`)
    document.embedding = await this.embeddingService.embed(document.content)

    // Store
    this.documents.push(document)
    this.embeddings.set(document.id, document.embedding)

    console.log(`✅ Added document: ${document.id} (${document.content.length} chars)`)

    return document
  }

  /**
   * Search documents
   */
  async search(query: string, limit: number = 5, threshold: number = 0.3): Promise<SearchResult[]> {
    console.log(`🔍 Searching knowledge base for: "${query}"`)

    if (this.documents.length === 0) {
      console.warn(`⚠️ Knowledge base is empty`)
      return []
    }

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.embed(query)

    // Calculate similarities
    const results: SearchResult[] = []

    for (const document of this.documents) {
      if (!document.embedding) continue

      const score = this.embeddingService.cosineSimilarity(queryEmbedding, document.embedding)

      if (score >= threshold) {
        let relevance: 'high' | 'medium' | 'low'
        if (score >= 0.7) relevance = 'high'
        else if (score >= 0.5) relevance = 'medium'
        else relevance = 'low'

        results.push({
          document,
          score,
          relevance
        })
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score)

    return results.slice(0, limit)
  }

  /**
   * Get context for RAG
   */
  async getContext(query: string, contextCount: number = 3): Promise<Document[]> {
    const results = await this.search(query, contextCount)
    return results.map((r) => r.document)
  }

  /**
   * Generate RAG response
   */
  async generateResponse(query: RAGQuery): Promise<RAGResponse> {
    console.log(`📝 Generating RAG response for: "${query.question}"`)

    // Get relevant context
    const context = await this.getContext(query.question, query.contextCount || 3)

    if (context.length === 0) {
      return {
        answer: `I don't have relevant information to answer: "${query.question}"`,
        sources: [],
        confidence: 0,
        generatedAt: new Date()
      }
    }

    // Build context string
    const contextStr = context
      .map((doc) => {
        const snippet = doc.content.substring(0, 200)
        return `From "${doc.title}": ${snippet}...`
      })
      .join('\n\n')

    // Generate answer via AI if an API key is available
    let answer: string
    const orKey = process.env.OPENROUTER_API_KEY

    if (orKey && !process.env.VITEST) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${orKey}`,
            'HTTP-Referer': 'https://github.com/arosstale/pi-builder',
            'X-Title': 'pi-builder',
          },
          body: JSON.stringify({
            model: 'anthropic/claude-haiku-4-5',
            max_tokens: 1024,
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant. Answer questions using only the provided context.',
              },
              {
                role: 'user',
                content: `Context:\n${contextStr}\n\nQuestion: ${query.question}`,
              },
            ],
          }),
        })

        if (res.ok) {
          const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
          answer = data.choices[0]?.message?.content ?? `No answer generated for: "${query.question}"`
        } else {
          answer = `Based on my knowledge base:\n${contextStr}\n\nAnswer to "${query.question}": [API error ${res.status}]`
        }
      } catch {
        answer = `Based on my knowledge base:\n${contextStr}\n\nAnswer to "${query.question}": [Network error]`
      }
    } else {
      // Offline / test mode
      answer = `Based on my knowledge base:\n${contextStr}\n\nAnswer to "${query.question}": [Set OPENROUTER_API_KEY for AI-generated answers]`
    }

    return {
      answer,
      sources: context,
      confidence: context.length > 0 ? Math.min(1, 0.5 + context.length * 0.15) : 0,
      generatedAt: new Date()
    }
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): Document | null {
    return this.documents.find((d) => d.id === id) || null
  }

  /**
   * List all documents
   */
  listDocuments(): Document[] {
    return [...this.documents]
  }

  /**
   * Get knowledge base stats
   */
  getStats(): {
    totalDocuments: number
    totalChars: number
    avgDocSize: number
    sources: Record<string, number>
    newestDocument?: Document
    oldestDocument?: Document
  } {
    const totalChars = this.documents.reduce((sum, d) => sum + d.content.length, 0)
    const sources: Record<string, number> = {}

    for (const doc of this.documents) {
      sources[doc.source] = (sources[doc.source] || 0) + 1
    }

    const sorted = [...this.documents].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return {
      totalDocuments: this.documents.length,
      totalChars,
      avgDocSize: this.documents.length > 0 ? totalChars / this.documents.length : 0,
      sources,
      newestDocument: sorted[0],
      oldestDocument: sorted[sorted.length - 1]
    }
  }

  /**
   * Clear knowledge base
   */
  clear(): void {
    this.documents = []
    this.embeddings.clear()
    console.log(`🗑️ Knowledge base cleared`)
  }

  /**
   * Export documents
   */
  export(): Document[] {
    return JSON.parse(JSON.stringify(this.documents))
  }

  /**
   * Import documents
   */
  async import(documents: Document[]): Promise<void> {
    console.log(`📥 Importing ${documents.length} documents`)

    for (const doc of documents) {
      await this.addDocument(doc)
    }

    console.log(`✅ Import complete`)
  }
}
