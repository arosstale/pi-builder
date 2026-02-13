# PI-BUILDER PRODUCTION DEPLOYMENT GUIDE

## Phases 1-11 Complete | Enterprise-Ready | Production Hardened

---

## 📋 **QUICK START CHECKLIST**

```bash
# 1. Verify build
npm run build

# 2. Run full test suite
npm run test

# 3. Check code quality
npm run typecheck
npm run lint

# 4. Deploy to staging
npm run deploy:staging

# 5. Run smoke tests
npm run test:integration

# 6. Deploy to production
npm run deploy:prod
```

---

## 🚀 **DEPLOYMENT MODES**

### Option 1: Docker Container

```bash
# Build image
docker build -t pi-builder:latest .

# Run container
docker run -d \
  --name pi-builder \
  -e CLAUDE_API_KEY=$CLAUDE_API_KEY \
  -e DATABASE_URL=$DATABASE_URL \
  -p 3000:3000 \
  pi-builder:latest

# Verify
curl http://localhost:3000/health
```

### Option 2: Kubernetes

```bash
# Deploy manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=pi-builder

# Scale agents
kubectl scale deployment pi-builder-agent --replicas=5

# View logs
kubectl logs -l app=pi-builder -f
```

### Option 3: Serverless (AWS Lambda)

```bash
# Package for Lambda
npm run build:lambda

# Deploy
serverless deploy

# Invoke
aws lambda invoke \
  --function-name pi-builder \
  --payload '{"action":"generate"}' \
  response.json
```

---

## 🔒 **SECURITY SETUP**

### Environment Variables (Required)

```bash
# Core APIs
CLAUDE_API_KEY=sk-ant-...
GEMINI_API_KEY=sk-...
OPENAI_API_KEY=sk-...

# Database
DATABASE_URL=postgresql://user:pass@host/db
REDIS_URL=redis://host:6379

# Security
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Features
ENABLE_SANDBOX=true
ENABLE_OBSERVABILITY=true
ENABLE_ANALYTICS=true
```

### SSL/TLS

```bash
# Generate self-signed cert (development)
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365

# Production: Use Let's Encrypt
certbot certonly --standalone -d api.pi-builder.io
```

### Firewall Rules

```bash
# Allow API traffic
allow 443/tcp (HTTPS)
allow 80/tcp (HTTP - redirect to HTTPS)

# Allow WebSocket (observability)
allow 8080/tcp (WebSocket)

# Restrict admin access
allow 22/tcp from bastion-host-only (SSH)

# Block all else
deny 0.0.0.0/0
```

---

## 📊 **MONITORING & ALERTS**

### Metrics to Monitor

```typescript
// Health check endpoint
GET /health
Response: {
  status: "healthy",
  uptime: 3600,
  agents: { total: 5, running: 5 },
  taskQueue: { pending: 2, processing: 3 },
  cacheHitRate: 0.92,
  errorRate: 0.001
}

// Real-time dashboard
GET /api/observability/dashboard
Response: {
  activeTraces: 42,
  orchestrations: 8,
  performanceMetrics: {...},
  systemHealth: {...}
}

// Analytics
GET /api/analytics/report
Response: {
  agentPerformance: [...],
  costBreakdown: {...},
  errorAnalysis: [...],
  recommendations: [...]
}
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | >1% | >5% | Page oncall |
| Response Time | >1000ms | >5000ms | Scale up |
| Cache Hit Rate | <80% | <50% | Investigate |
| Sandbox Timeout | >5 | >10 | Kill process |
| Cost/Task | >$0.10 | >$0.50 | Switch model |
| Agent Queue | >100 | >500 | Scale workers |

### Monitoring Stack

```yaml
# Prometheus scrape config
scrape_configs:
  - job_name: 'pi-builder'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
    scrape_interval: 15s

# Grafana dashboards
- Agent Performance Dashboard
- Cost Analysis Dashboard
- System Health Dashboard
- Real-Time Observability Dashboard

# AlertManager rules
- alert: HighErrorRate
  expr: error_rate > 0.05
  for: 5m
  action: notify_oncall

- alert: SandboxTimeout
  expr: sandbox_timeout_count > 10
  for: 1m
  action: scale_workers
```

---

## 🗄️ **DATABASE SETUP**

### PostgreSQL (Production)

```sql
-- Create database
CREATE DATABASE pi_builder;

-- Create schemas
CREATE SCHEMA agents;
CREATE SCHEMA tasks;
CREATE SCHEMA observability;
CREATE SCHEMA analytics;

-- Create key tables
CREATE TABLE agents.agents (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  model VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tasks.executions (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents.agents(id),
  sandbox_id VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  exit_code INTEGER
);

CREATE TABLE observability.events (
  id UUID PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  INDEX idx_session (session_id),
  INDEX idx_event_type (event_type)
);

CREATE TABLE analytics.metrics (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents.agents(id),
  metric_name VARCHAR(255) NOT NULL,
  value DECIMAL(10, 4),
  timestamp TIMESTAMP DEFAULT NOW(),
  INDEX idx_agent_metric (agent_id, metric_name)
);

-- Backup schedule
pg_dump pi_builder | gzip > /backups/pi_builder_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Redis Cache

```bash
# Start Redis
redis-server --port 6379 --requirepass $REDIS_PASSWORD

# Create cache patterns
redis-cli CONFIG SET maxmemory 4gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxclients 10000

# Monitor
redis-cli INFO stats
redis-cli MONITOR
```

---

## 🔄 **CI/CD PIPELINE**

### GitHub Actions

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:ci
      - run: npm run test:integration

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  deploy-staging:
    needs: [test, security]
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run deploy:staging
        env:
          STAGING_TOKEN: ${{ secrets.STAGING_TOKEN }}

  deploy-prod:
    needs: [test, security]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run deploy:prod
        env:
          PROD_TOKEN: ${{ secrets.PROD_TOKEN }}
      - name: Smoke tests
        run: npm run test:smoke
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text":"Pi-Builder deployed to production"}'
```

---

## 🛡️ **COMPLIANCE & AUDIT**

### SOC 2 Compliance

```bash
# Audit logging
export LOG_LEVEL=audit
logs appear in /var/log/pi-builder/audit/

# User access tracking
GET /api/audit/access-logs
{
  userId: "user-123",
  action: "agent_execute",
  resource: "agent-456",
  timestamp: "2026-02-14T10:30:00Z",
  result: "success"
}

# Data encryption at rest
AES-256-GCM on all sensitive data
Encryption keys rotated monthly

# Data encryption in transit
TLS 1.3 minimum
Perfect forward secrecy enabled
```

### GDPR Compliance

```bash
# Data access requests
GET /api/gdpr/export-user-data?user_id=123

# Right to deletion
DELETE /api/gdpr/delete-user-data?user_id=123
- Deletion logs preserved for compliance
- References cascade deleted

# Data retention
Automated cleanup of events >90 days old
Exception: audit logs retained 7 years
```

---

## 🧪 **TESTING IN PRODUCTION**

### Smoke Tests

```bash
npm run test:smoke

# Covers:
# ✅ API endpoints responsive
# ✅ Database connectivity
# ✅ Cache working
# ✅ Agent spawning
# ✅ Core agent workflows
```

### Canary Deployment

```bash
# Route 5% traffic to new version
kubectl patch service pi-builder -p \
  '{"spec":{"selector":{"version":"v2"}:0.05}}'

# Monitor error rate
# If OK, gradually increase to 10%, 25%, 50%, 100%
# If error rate >1%, rollback immediately
```

### Blue-Green Deployment

```bash
# Deploy new version (green)
kubectl set image deployment/pi-builder-green \
  pi-builder=pi-builder:v2.0.0

# Wait for ready
kubectl wait --for=condition=available \
  --timeout=300s deployment/pi-builder-green

# Switch traffic
kubectl patch service pi-builder \
  -p '{"spec":{"selector":{"version":"v2"}}}'

# Keep old version (blue) ready for rollback
```

---

## 📈 **SCALING STRATEGY**

### Horizontal Scaling (Add more agents)

```bash
# Monitor queue depth
watch 'curl http://localhost:3000/api/metrics/queue'

# Scale agents when queue depth >100
kubectl scale deployment pi-builder-agent --replicas=10

# Auto-scaling rules
- Min replicas: 2
- Max replicas: 50
- Target CPU: 70%
- Target Memory: 80%
```

### Vertical Scaling (More powerful instances)

```bash
# Increase limits for CPU-bound tasks
kubectl patch deployment pi-builder-agent -p \
  '{"spec":{"template":{"spec":{"containers":[{
    "name":"pi-builder",
    "resources":{"limits":{"cpu":"4","memory":"8Gi"}}
  }]}}}}'
```

### Database Scaling

```sql
-- Connection pooling
SET max_connections = 200;

-- Read replicas for analytics queries
CREATE PUBLICATION analytics_pub FOR TABLE analytics.metrics;

-- Query analysis
EXPLAIN ANALYZE SELECT * FROM tasks.executions WHERE status='running';
```

---

## 🚨 **INCIDENT RESPONSE**

### High Error Rate

```bash
# 1. Check logs
kubectl logs -l app=pi-builder --tail=100 | grep ERROR

# 2. Check metrics
curl http://localhost:3000/api/metrics

# 3. Check database
SELECT COUNT(*) FROM tasks.executions WHERE status='failed';

# 4. Rollback if needed
kubectl rollout undo deployment/pi-builder

# 5. Notify team
curl -X POST https://hooks.slack.com/services/... \
  -d '{"text":"PI-BUILDER ERROR RATE HIGH - Rolling back"}'
```

### Out of Memory

```bash
# Check memory usage
kubectl top pods -l app=pi-builder

# Increase memory limit
kubectl patch deployment pi-builder -p \
  '{"spec":{"template":{"spec":{"containers":[{
    "name":"pi-builder",
    "resources":{"limits":{"memory":"16Gi"}}
  }]}}}}'

# Clear cache if needed
redis-cli FLUSHDB

# Restart pods
kubectl rollout restart deployment/pi-builder
```

### Database Locked

```bash
# Check active connections
SELECT * FROM pg_stat_activity;

# Kill long-running queries
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE usename = 'pi_builder' AND state = 'active'
  AND query_start < NOW() - INTERVAL '1 hour';

# Analyze slow queries
ANALYZE;
VACUUM ANALYZE;
```

---

## 🎓 **RUNBOOKS**

### Deploy to Staging
1. Push to staging branch
2. GitHub Actions runs tests & security scans
3. Automatic deployment to staging
4. Manual smoke tests
5. Promotion approved in Slack

### Deploy to Production
1. Create release PR with changelog
2. All tests pass & security scan passes
3. Get 2 approvals
4. Merge to main
5. GitHub Actions deploys to production
6. Monitor error rate for 10 minutes
7. If OK, notify team

### Rollback to Previous Version
1. Identify problem: `kubectl logs -f pod-name`
2. Rollback: `kubectl rollout undo deployment/pi-builder`
3. Verify: `curl http://api.pi-builder.io/health`
4. Notify: Slack message to team
5. Post-mortem: Schedule analysis

---

## 📞 **SUPPORT & ESCALATION**

### On-Call Schedule
- Primary: Engineer 1
- Secondary: Engineer 2
- Escalation: Team Lead

### Response Times
- Critical (system down): 15 minutes
- High (feature broken): 1 hour
- Medium (degraded): 4 hours
- Low (enhancement): Next sprint

### Communication Channels
- Alerts: PagerDuty + Slack
- Updates: Status page + Twitter
- Internal: Slack #incidents
- External: support@pi-builder.io

---

## ✅ **PRE-DEPLOYMENT CHECKLIST**

- [ ] All tests passing (960+)
- [ ] Code quality score >9.8
- [ ] No security vulnerabilities
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Backups verified
- [ ] Monitoring alerts configured
- [ ] Runbooks reviewed
- [ ] On-call team notified
- [ ] Change log updated
- [ ] Stakeholders informed
- [ ] Rollback plan ready

---

## 🎉 **DEPLOYMENT SUCCESS CRITERIA**

✅ System health: 99.9% uptime  
✅ Error rate: <0.1%  
✅ Response time: <500ms p99  
✅ All tests passing: 960+  
✅ Database: No data loss  
✅ Observability: All metrics collected  
✅ Compliance: Audit logs maintained  
✅ Security: Zero breaches  

---

**Status**: PRODUCTION DEPLOYMENT READY ✅  
**Last Updated**: February 14, 2026  
**Build Version**: v1.0.0  
**Confidence Level**: MAXIMUM ✅  
