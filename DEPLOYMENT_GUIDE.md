# Deployment Guide: Pi Builder v1.1

## 🚀 Production Deployment Strategies

This guide covers various deployment approaches for Pi Builder v1.1.

---

## Table of Contents

1. [npm Package Deployment](#npm-package-deployment)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Cloud Platform Deployment](#cloud-platform-deployment)
5. [Production Checklist](#production-checklist)

---

## npm Package Deployment

### Standard npm Installation

```bash
# Install latest version
npm install pi-builder

# Install specific version
npm install pi-builder@1.1.0

# Install with dependencies
npm install pi-builder --save
```

### Configuration

```typescript
// import.ts
import {
  PiBuilder,
  ProviderRouter,
  CostTracker,
  CacheStrategy,
} from 'pi-builder'

const builder = new PiBuilder({
  providers: ['openai', 'anthropic', 'gemini'],
  caching: {
    strategy: 'multi',
    ttl: 3600,
  },
  monitoring: {
    enabled: true,
    alertThreshold: 0.8,
  },
})
```

### Monorepo Usage

```bash
# Install scoped packages
npm install @pi-builder/core
npm install @pi-builder/types
npm install @pi-builder/utils
npm install @pi-builder/prompts
```

---

## Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy source
COPY . .

# Install and build
RUN npm ci
RUN npm run build
RUN npm run test

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies only
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  pi-builder:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
    volumes:
      - ./logs:/app/logs
      - ./cache:/app/cache
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

---

## Kubernetes Deployment

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pi-builder
  labels:
    app: pi-builder

spec:
  replicas: 3
  selector:
    matchLabels:
      app: pi-builder

  template:
    metadata:
      labels:
        app: pi-builder

    spec:
      containers:
        - name: pi-builder
          image: your-registry/pi-builder:1.1.0
          imagePullPolicy: IfNotPresent

          ports:
            - name: http
              containerPort: 3000

          env:
            - name: NODE_ENV
              value: 'production'
            - name: LOG_LEVEL
              value: 'info'
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: api-keys
                  key: openai

          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi

          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30

          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10

          lifecycle:
            preStop:
              exec:
                command: ['/bin/sh', '-c', 'sleep 15']

---
apiVersion: v1
kind: Service
metadata:
  name: pi-builder-service

spec:
  selector:
    app: pi-builder
  type: LoadBalancer
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pi-builder-hpa

spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pi-builder
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## Cloud Platform Deployment

### AWS Lambda

```python
# lambda_handler.py
import json
from pi_builder import PiBuilder

builder = PiBuilder()

def lambda_handler(event, context):
    try:
        result = builder.handle_request(event['body'])
        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
```

### Google Cloud Run

```bash
# Deploy to Cloud Run
gcloud run deploy pi-builder \
  --source . \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60s \
  --max-instances 100 \
  --set-env-vars NODE_ENV=production
```

### Azure App Service

```bash
# Deploy to Azure
az webapp up \
  --name pi-builder \
  --resource-group myResourceGroup \
  --sku B1 \
  --runtime node \
  --runtime-version 20
```

---

## Production Configuration

### Environment Variables

```bash
# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Performance
CACHE_ENABLED=true
CACHE_TTL=3600
MAX_TOKENS=4096

# Monitoring
MONITORING_ENABLED=true
TRACING_ENABLED=true
METRICS_ENABLED=true

# Security
AUTH_ENABLED=true
RATE_LIMIT_ENABLED=true
REQUEST_TIMEOUT=30000
```

### Health Checks

```typescript
// health-check.ts
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: await checkDatabase(),
      cache: await checkCache(),
      providers: await checkProviders(),
    },
  }

  res.json(health)
})
```

### Metrics & Monitoring

```typescript
// monitoring.ts
import { ProviderMonitor } from 'pi-builder'

const monitor = new ProviderMonitor()

// Track metrics
monitor.trackLatency('provider-name', duration)
monitor.trackError('provider-name', errorType)
monitor.trackSuccess('provider-name', tokensUsed)

// Export metrics
app.get('/metrics', (req, res) => {
  res.json(monitor.getMetrics())
})
```

---

## Production Checklist

### Pre-Deployment

- [ ] All tests passing (138+ tests)
- [ ] Code review completed
- [ ] Security audit passed
- [ ] Performance benchmarks acceptable
- [ ] Documentation updated
- [ ] API keys configured
- [ ] Database migrations run
- [ ] Cache warmed up

### Deployment

- [ ] Staging environment tested
- [ ] Blue-green deployment ready
- [ ] Rollback plan documented
- [ ] Health checks configured
- [ ] Monitoring enabled
- [ ] Alerting configured
- [ ] Logs aggregated
- [ ] CDN configured

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check response times
- [ ] Verify cache hit rates
- [ ] Monitor cost metrics
- [ ] Check provider health
- [ ] Gather user feedback
- [ ] Document lessons learned
- [ ] Plan next update

---

## Scaling Considerations

### Horizontal Scaling

```yaml
# 2-10 replicas based on load
minReplicas: 2
maxReplicas: 10

# Scale on CPU (70%) and Memory (80%)
targetCPUUtilizationPercentage: 70
targetMemoryUtilizationPercentage: 80
```

### Load Balancing

- Use load balancer with health checks
- Distribute requests across replicas
- Sticky sessions if needed
- Consider geographical distribution

### Caching Strategy

- Use Redis for distributed caching
- Set appropriate TTLs
- Monitor hit rates (target: 40%+)
- Implement cache invalidation

---

## Monitoring & Observability

### Key Metrics

```
latency (p50, p95, p99)
throughput (RPS)
error rate (%)
cache hit rate (%)
token usage
cost per request
provider health scores
```

### Alerting

```
Alert when:
- Error rate > 5%
- Latency p95 > 1s
- Cache hit rate < 30%
- Cost exceeds budget
- Provider health < 0.7
```

### Logging

```bash
# Structured logging
{
  "timestamp": "2025-02-12T12:00:00Z",
  "level": "info",
  "service": "pi-builder",
  "request_id": "req-123",
  "operation": "provider_call",
  "provider": "openai",
  "latency_ms": 250,
  "tokens_used": 150
}
```

---

## Troubleshooting

### High Latency

```bash
# Check cache hit rate
curl http://localhost:3000/metrics | grep cache_hit_rate

# Check provider health
curl http://localhost:3000/metrics | grep provider_health

# Review logs for slow operations
grep "latency_ms.*[5-9][0-9][0-9]" logs/app.log
```

### High Error Rate

```bash
# Check error breakdown
curl http://localhost:3000/metrics | grep error_rate

# Review error logs
tail -f logs/error.log

# Check provider status
curl http://localhost:3000/health | jq '.checks.providers'
```

### Memory Leaks

```bash
# Check memory usage
ps aux | grep node

# Generate heap dump
node --inspect app.js
# Visit chrome://inspect
```

---

## Rollback Plan

```bash
# Immediate rollback if critical issues detected
git revert <commit-hash>
npm run build
docker build -t pi-builder:rollback .
kubectl set image deployment/pi-builder \
  pi-builder=pi-builder:rollback --record
```

---

## Support & Resources

- [GitHub Issues](https://github.com/YOUR_USERNAME/pi-builder/issues)
- [Documentation](https://github.com/YOUR_USERNAME/pi-builder/blob/main/README.md)
- [QUICK_START.md](./QUICK_START.md)
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)

---

**Production deployment ready! 🚀**

