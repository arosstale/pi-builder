# DEEP RESEARCH: Auto Maker Complete Architecture

## 📊 Project Statistics

- **Total TypeScript Files**: 811 (excluding node_modules)
- **Code Lines**: 19,345+
- **Provider Count**: 7 (Claude, Cursor, Codex, OpenCode, Gemini, Copilot, CLI)
- **Architecture**: Monorepo with 14 workspaces
- **Core Pattern**: Provider Factory + Base Class + Registry

---

## 🏗️ LAYER 1: PROVIDER ARCHITECTURE

### BaseProvider (Abstract)

```typescript
abstract class BaseProvider {
  protected config: ProviderConfig
  protected name: string

  abstract getName(): string
  abstract executeQuery(options): AsyncGenerator<ProviderMessage>
  abstract detectInstallation(): Promise<InstallationStatus>
  abstract getAvailableModels(): ModelDefinition[]
  
  validateConfig(): ValidationResult
  supportsFeature(feature: string): boolean
  getConfig(): ProviderConfig
  setConfig(partial: Partial<ProviderConfig>): void
}
```

**Key Methods:**
- `executeQuery()` - Returns AsyncGenerator for streaming
- `detectInstallation()` - Checks if provider is installed
- `getAvailableModels()` - Lists supported models
- `supportsFeature()` - Feature detection (vision, tools, MCP, etc.)

---

### CliProvider (Extends BaseProvider)

**Purpose:** Abstract base for CLI-based providers (Cursor, Codex, etc.)

**Key Features:**
1. **Platform-Specific Execution**
   - WSL detection and routing
   - NPX support
   - Direct Windows binary execution
   - CMD shell handling

2. **CLI Detection**
   ```typescript
   interface CliDetectionResult {
     cliPath: string | null
     useWsl: boolean
     wslCliPath?: string
     strategy: 'wsl' | 'npx' | 'direct' | 'cmd' | 'native'
   }
   ```

3. **Process Management**
   - JSONL subprocess spawning
   - Stream-based output handling
   - Error mapping infrastructure
   - Timeout management (120s base, vs 30s API)

4. **Spawn Strategies**
   - `'wsl'`: WSL-only tools (cursor-agent)
   - `'npx'`: NPM-installed packages
   - `'direct'`: Native Windows binaries
   - `'cmd'`: Windows batch files

**Example Structure:**
```typescript
abstract class CliProvider extends BaseProvider {
  protected cliPath: string | null = null
  protected useWsl: boolean = false
  protected wslCliPath: string | null = null
  protected detectedStrategy: SpawnStrategy | 'native'

  abstract getCliName(): string
  abstract getSpawnConfig(): CliSpawnConfig
  abstract buildCliArgs(options: ExecuteOptions): string[]
  abstract normalizeEvent(event: unknown): ProviderMessage | null
  
  protected mapError(stderr: string, exitCode?: number): CliErrorInfo
}
```

---

### ProviderFactory (Registry Pattern)

**Pattern:** Dynamic provider registration with priority-based routing

```typescript
interface ProviderRegistration {
  factory: () => BaseProvider
  aliases?: string[]
  canHandleModel?: (modelId: string) => boolean
  priority?: number  // Higher = checked first
}

const providerRegistry = new Map<string, ProviderRegistration>()

export class ProviderFactory {
  static getProviderNameForModel(model: string): ModelProvider
  static getProviderForModel(modelId: string, options?): BaseProvider
  static getProviderForModelName(modelId: string): string
  static getAllProviders(): BaseProvider[]
  static checkAllProviders(): Promise<Record<string, InstallationStatus>>
  static getProviderByName(name: string): BaseProvider | null
  static getAllAvailableModels(): ModelDefinition[]
  static getRegisteredProviderNames(): string[]
  static modelSupportsVision(modelId: string): boolean
}
```

**Priority-Based Routing Example:**
```
Cursor (priority: 10) > Copilot (priority: 6) > Codex (priority: 5) 
> Gemini (priority: 4) > OpenCode (priority: 3) > Claude (priority: 0)
```

**Registration Example:**
```typescript
registerProvider('cursor', {
  factory: () => new CursorProvider(),
  canHandleModel: (model: string) => isCursorModel(model),
  priority: 10
})
```

**Provider Disconnection Tracking:**
```typescript
const DISCONNECTED_MARKERS = {
  claude: '.claude-disconnected',
  codex: '.codex-disconnected',
  cursor: '.cursor-disconnected',
  // ... etc
}

function isProviderDisconnected(providerName: string): boolean {
  const markerPath = path.join(process.cwd(), '.automaker', markerFile)
  return fs.existsSync(markerPath)
}
```

---

## 🏗️ LAYER 2: PROVIDER IMPLEMENTATIONS

### ClaudeProvider (Native SDK)

**Key Characteristics:**
- Uses `@anthropic-ai/claude-agent-sdk`
- Supports custom endpoints
- Authentication sources: inline, env, credentials
- Token budget management

**Environment Variables:**
```typescript
const ALLOWED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'API_TIMEOUT_MS',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'PATH', 'HOME', 'SHELL', 'TERM', 'USER', 'LANG', 'LC_ALL'
]
```

**Configuration:**
```typescript
type ProviderConfig = ClaudeApiProfile | ClaudeCompatibleProvider

interface ClaudeApiProfile {
  name: string
  baseUrl: string
  apiKey?: string
  apiKeySource?: 'inline' | 'env' | 'credentials'
  useAuthToken?: boolean
  timeoutMs?: number
  disableNonessentialTraffic?: boolean
  modelMappings?: {
    haiku?: string
    sonnet?: string
    opus?: string
  }
}

interface ClaudeCompatibleProvider {
  name: string
  baseUrl: string
  models: string[]  // Direct model list (no mapping)
  // ... same as above
}
```

---

### CursorProvider (CLI-Based)

**Strategy:** WSL-based execution
- Spawns `cursor-agent` CLI tool
- Requires WSL on Windows
- Streams JSONL output
- 40KB+ implementation

---

### CursorConfigManager

**Responsibilities:**
- Detects Cursor IDE installation
- Manages auth configuration
- Stores provider settings
- Path discovery on multiple platforms

---

### CodexProvider (CLI-Based)

**Strategy:** OpenAI's Codex via CLI
- Codex CLI tool spawning
- Model mapping (davinci -> specific model ID)
- 38KB+ implementation
- Complex error handling

**Components:**
- `CodexProvider` - Main provider
- `CodexConfigManager` - Configuration
- `CodexModels` - Model definitions
- `CodexSdkClient` - SDK wrapper
- `CodexToolMapping` - Tool normalization

---

### CopilotProvider (GitHub SDK)

**Characteristics:**
- GitHub Copilot SDK integration
- OAuth token management
- Priority: 6 (higher than Codex, lower than Cursor)
- 29KB+ implementation

---

### GeminiProvider

**Characteristics:**
- Google Gemini API
- Vision support
- Tool calling
- 26KB+ implementation

---

### OpencodeProvider

**Characteristics:**
- OpenCode platform integration
- Model discovery
- Tool mapping
- 38KB+ implementation

---

## 🏗️ LAYER 3: ERROR HANDLING SYSTEM

### ErrorType Enumeration

```typescript
enum ErrorType {
  AUTHENTICATION = 'authentication',
  BILLING = 'billing',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  CLI_NOT_FOUND = 'cli_not_found',
  CLI_NOT_INSTALLED = 'cli_not_installed',
  MODEL_NOT_SUPPORTED = 'model_not_supported',
  INVALID_REQUEST = 'invalid_request',
  SERVER_ERROR = 'server_error',
  UNKNOWN = 'unknown'
}

enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### Error Classification System

**Pattern Matching:**
- Authentication: `unauthorized|not authenticated|please log in|token revoked`
- Billing: `credit.*balance.*low|insufficient.*credit|quota.*exceeded`
- Rate Limit: `rate.*limit|too.*many.*request|429|reset.*time`
- Network: `network|connection|dns|timeout|econnrefused`
- Timeout: `timeout|aborted|time.*out`
- Permission: `permission.*denied|access.*denied|403|forbidden`
- CLI: `command not found|not recognized|not installed|ENOENT`
- Model: `model.*not.*support|unknown.*model|invalid.*model`
- Server: `internal.*server|500|502|503|504`

**Classification Result:**
```typescript
interface ErrorClassification {
  type: ErrorType
  severity: ErrorSeverity
  userMessage: string
  technicalMessage: string
  suggestedAction?: string
  retryable: boolean
  provider?: string
  context?: Record<string, any>
}
```

**Key Functions:**
```typescript
classifyError(error, provider?, context?)
getUserFriendlyErrorMessage(error, provider?)
isRetryableError(error)
isAuthenticationError(error)
isBillingError(error)
isRateLimitError(error)
createErrorResponse(error, provider?, context?)
logError(error, provider?, operation?, additionalContext?)
createRetryHandler(maxRetries, baseDelay)
```

---

## 🏗️ LAYER 4: TOOL NORMALIZATION

### Purpose
Different providers use different parameter names. Normalize to standard.

### Normalization Functions

**1. Todo Normalization**
```typescript
function normalizeTodos(todos): NormalizedTodo[]
// Handles: Gemini, Copilot differences
// Output: { content, status, activeForm }
// Status mapping: 'cancelled' -> 'completed'
```

**2. File Path Normalization**
```typescript
function normalizeFilePathInput(input)
// Handles: path, file, filename, filePath -> file_path
```

**3. Command Normalization**
```typescript
function normalizeCommandInput(input)
// Handles: cmd, script -> command
```

**4. Pattern Normalization**
```typescript
function normalizePatternInput(input)
// Handles: query, search, regex -> pattern
```

---

## 🏗️ LAYER 5: PROVIDER TYPES & INTERFACES

### Core Types

```typescript
interface ProviderConfig {
  [key: string]: any
}

interface ExecuteOptions {
  model: string
  prompt: string
  // ... other options
}

interface ProviderMessage {
  type: string
  content?: string
  // ... other fields
}

interface InstallationStatus {
  installed: boolean
  version?: string
  authenticated?: boolean
  configValid?: boolean
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

interface ModelDefinition {
  id: string
  modelString: string
  displayName: string
  provider: string
  supportsVision?: boolean
  supportsTools?: boolean
  supportsMCP?: boolean
  contextWindow?: number
  costPer1kInputTokens?: number
  costPer1kOutputTokens?: number
}
```

---

## 🏗️ LAYER 6: STREAMING & EVENTS

### Simple Query Service

**Two-Mode API:**
```typescript
// Mode 1: Simple completion
export function simpleQuery(options: SimpleQueryOptions): Promise<SimpleQueryResult>

// Mode 2: Streaming
export function streamingQuery(options: StreamingQueryOptions): AsyncGenerator<string, void>
```

---

## 🎯 PI BUILDER IMPROVEMENTS (Based on Deep Research)

### 1. **Enhanced Provider Abstraction**
✅ Keep the BaseProvider pattern
✅ Keep the CliProvider abstraction
✅ Keep the ProviderFactory registry pattern
❌ Switch from CLI to native SDKs where possible
✅ Add health metrics to each provider

### 2. **Cost Tracking Integration**
❌ Auto Maker: No token counting per request
✅ Pi Builder: Count input/output tokens for every provider
✅ Add token budget tracking per request
✅ Track cost per provider per model
✅ Historical cost analytics

### 3. **Model Registry Enhancement**
❌ Auto Maker: Models are per-provider, fragmented
✅ Pi Builder: Centralized model registry
✅ Pre-loaded 20+ models with metadata
✅ Token limits & cost per model
✅ Capability matrix (vision, tools, MCP, etc.)
✅ Searchable by capability

### 4. **Provider Health Monitoring**
❌ Auto Maker: No health metrics
✅ Pi Builder: Real-time metrics per provider
✅ Latency tracking (p50, p95, p99)
✅ Error rate monitoring
✅ Availability scoring
✅ Queue depth tracking

### 5. **Intelligent Router**
❌ Auto Maker: Manual provider selection
✅ Pi Builder: Automatic based on:
   - Cost optimization (select cheapest)
   - Latency optimization (select fastest)
   - Quality optimization (select best model)
   - Failover chain (automatic fallback)

### 6. **Provider Pooling**
❌ Auto Maker: One provider at a time
✅ Pi Builder: Execute in parallel across providers
✅ Return fastest result (fastest-first strategy)
✅ Cost-optimized selection
✅ Load balancing

### 7. **Error Handling Enhancement**
✅ Keep pattern matching approach
✅ Extend with provider-specific patterns
❌ Auto Maker: No retry scheduling
✅ Pi Builder: Exponential backoff with jitter
✅ Circuit breaker pattern
✅ Automatic failure recovery

### 8. **Caching Strategy**
❌ Auto Maker: No caching
✅ Pi Builder: Multiple strategies:
   - Content-based (prompt hash)
   - Model-based (model output)
   - User-based (per session)
   - Global (shared cache)
✅ 40%+ target hit rate
✅ Invalidation strategies

### 9. **Tool Normalization Enhancement**
✅ Keep the normalization functions
✅ Extend with provider-specific mappings
✅ Add capability detection per tool
✅ Tool availability matrix

### 10. **Observability & Logging**
❌ Auto Maker: Basic logging
✅ Pi Builder: Production-grade:
   - Request ID tracking (distributed tracing)
   - Token counting per request
   - Cost calculation inline
   - Latency measurement (total, first-token)
   - Message history storage
   - Structured logging
   - Metrics export (Prometheus, etc.)

---

## 🎯 ARCHITECTURE COMPARISON

### Auto Maker
```
User Input
    ↓
ProviderFactory.getProviderForModel()
    ↓
Provider (CLI or SDK)
    ↓
Execute/Stream
    ↓
Error Handling
    ↓
Return Result
```

### Pi Builder v1.1 (Proposed)
```
User Input
    ↓
CostTrackingLayer (intercept)
    ↓
ProviderRouter (select best provider)
    ↓
CacheStrategy (check cache first)
    ↓
ProviderPool (execute in parallel if needed)
    ↓
EnhancedProvider (SDK-based, with metrics)
    ↓
EnhancedEventEmitter (stream with cost tracking)
    ↓
ProviderMonitor (record health metrics)
    ↓
EnhancedErrorHandler (classify + retry)
    ↓
RequestLogger (record everything)
    ↓
CacheStore (cache result)
    ↓
Return Enriched Result (with metrics)
```

---

## 💡 KEY INSIGHTS FROM RESEARCH

### 1. Disconnection Markers
Auto Maker uses marker files (`.claude-disconnected`) to track provider state.
**Insight:** Simple but effective pattern. Keep it, but make it queryable.

### 2. Provider Priority
The registry pattern with priorities is brilliant for dynamic routing.
**Insight:** Extend this to include cost, latency, quality factors.

### 3. CLI Detection Complexity
The CLI provider handles WSL, NPX, direct, and CMD spawning.
**Insight:** This is why native SDKs are better - no spawn complexity.

### 4. Token Budget Management
Claude provider manages thinking token budgets.
**Insight:** Generalize this to all providers + add cost tracking.

### 5. Error Pattern Matching
15+ error patterns with regex matching.
**Insight:** Solid approach, but can be extended with provider-specific patterns.

### 6. Streaming Architecture
AsyncGenerator pattern for streaming.
**Insight:** Perfect pattern, enhance with cost tracking middleware.

### 7. Model Definition Structure
ModelDefinition has: id, displayName, provider, supportsVision.
**Insight:** Extend with: costPer1kTokens, contextWindow, capabilities matrix.

---

## 🚀 IMPLEMENTATION ROADMAP (Based on Research)

### Phase 1: Adopt & Enhance (Week 1)
- [ ] Copy BaseProvider, CliProvider, ProviderFactory patterns
- [ ] Enhance with metrics collection
- [ ] Add cost tracking fields to ModelDefinition
- [ ] Create EnhancedEventEmitter with cost tracking
- [ ] Tests: 42

### Phase 2: Intelligence (Week 2)
- [ ] Build ModelRegistry with 20+ models
- [ ] Build ProviderRouter with selection strategies
- [ ] Build ProviderMonitor for health metrics
- [ ] Build CostTrackingLayer
- [ ] Tests: 37

### Phase 3: Optimization (Week 3)
- [ ] Build CacheStrategy (4 strategies)
- [ ] Build PromptOptimizer
- [ ] Build RequestLogger (distributed tracing)
- [ ] Integration tests
- [ ] Tests: 44

### Phase 4: Production (Week 4)
- [ ] Performance testing vs Auto Maker
- [ ] Load testing
- [ ] Security audit
- [ ] Full documentation
- [ ] Tests: 20+

---

## 📚 Auto Maker Code Lines by Component

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| BaseProvider | base-provider.ts | 89 | Abstract interface |
| CliProvider | cli-provider.ts | 600+ | CLI tool execution |
| ProviderFactory | provider-factory.ts | 300+ | Dynamic routing |
| ClaudeProvider | claude-provider.ts | 450+ | Claude SDK |
| CursorProvider | cursor-provider.ts | 1000+ | Cursor CLI |
| CodexProvider | codex-provider.ts | 1200+ | Codex CLI |
| CopilotProvider | copilot-provider.ts | 900+ | GitHub Copilot |
| GeminiProvider | gemini-provider.ts | 800+ | Google Gemini |
| OpencodeProvider | opencode-provider.ts | 1200+ | OpenCode CLI |
| ErrorHandler | error-handler.ts | 400+ | Error classification |
| ToolNormalization | tool-normalization.ts | 150+ | Tool mapping |

---

## ✅ RESEARCH COMPLETE

**Status:** Deep research into Auto Maker architecture complete
**Result:** Clear blueprint for Pi Builder v1.1 implementation
**Next:** Start building Phase 1 components

