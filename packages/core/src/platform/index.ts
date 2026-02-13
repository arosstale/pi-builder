/**
 * Platform Features
 * Kubernetes, serverless, and plugin support
 * @module platform
 */

export * from './kubernetes-manager'
export * from './serverless-manager'
export * from './plugin-system'

// Phase 12 Track 5: SaaS Infrastructure
export {
  SaaSInfrastructure,
  AuthenticationService,
  TenantService,
  BillingService,
  APIKeyService,
  RateLimitService
} from './saas-infrastructure'
export type {
  Tenant,
  User,
  Plan,
  Subscription,
  BillingEvent,
  APIKey
} from './saas-infrastructure'

export {
  K8sDeploymentGenerator,
  K8sClusterManager,
  ProductionClusterSetup
} from './kubernetes-setup'
export type {
  K8sDeploymentConfig,
  K8sServiceConfig,
  K8sIngressConfig,
  K8sStatefulSetConfig,
  PodMetrics
} from './kubernetes-setup'
