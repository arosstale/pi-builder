/**
 * Kubernetes Setup & Management
 * Production deployment configuration
 */

export interface K8sDeploymentConfig {
  name: string
  namespace: string
  replicas: number
  image: string
  imageTag: string
  port: number
  resources: {
    cpu: string
    memory: string
  }
  env: Record<string, string>
  healthCheck?: {
    enabled: boolean
    path: string
    initialDelaySeconds: number
    periodSeconds: number
  }
}

export interface K8sServiceConfig {
  name: string
  namespace: string
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer'
  port: number
  targetPort: number
  selector: Record<string, string>
}

export interface K8sIngressConfig {
  name: string
  namespace: string
  host: string
  paths: Array<{
    path: string
    pathType: 'Prefix' | 'Exact'
    backend: {
      service: string
      port: number
    }
  }>
  tlsEnabled: boolean
  certIssuer?: string
}

export interface K8sStatefulSetConfig {
  name: string
  namespace: string
  serviceName: string
  replicas: number
  image: string
  imageTag: string
  storage: {
    size: string
    storageClass: string
  }
  volumeMounts: Array<{
    name: string
    mountPath: string
  }>
}

export interface PodMetrics {
  podName: string
  namespace: string
  cpuUsage: string
  memoryUsage: string
  restartCount: number
  age: string
}

/**
 * Kubernetes Deployment Generator
 */
export class K8sDeploymentGenerator {
  /**
   * Generate deployment YAML
   */
  generateDeployment(config: K8sDeploymentConfig): string {
    const healthCheck = config.healthCheck
      ? `
      livenessProbe:
        httpGet:
          path: ${config.healthCheck.path}
          port: ${config.port}
        initialDelaySeconds: ${config.healthCheck.initialDelaySeconds}
        periodSeconds: ${config.healthCheck.periodSeconds}
      readinessProbe:
        httpGet:
          path: ${config.healthCheck.path}
          port: ${config.port}
        initialDelaySeconds: 5
        periodSeconds: 10`
      : ''

    const env = Object.entries(config.env)
      .map(([key, value]) => `      - name: ${key}\n        value: "${value}"`)
      .join('\n')

    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.name}
  namespace: ${config.namespace}
  labels:
    app: ${config.name}
    managed-by: pi-builder
spec:
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${config.name}
  template:
    metadata:
      labels:
        app: ${config.name}
    spec:
      containers:
      - name: ${config.name}
        image: ${config.image}:${config.imageTag}
        imagePullPolicy: Always
        ports:
        - containerPort: ${config.port}
        resources:
          requests:
            cpu: ${config.resources.cpu}
            memory: ${config.resources.memory}
          limits:
            cpu: ${config.resources.cpu}
            memory: ${config.resources.memory}${env ? `\n        env:\n${env}` : ''}${healthCheck}
      restartPolicy: Always`
  }

  /**
   * Generate service YAML
   */
  generateService(config: K8sServiceConfig): string {
    return `apiVersion: v1
kind: Service
metadata:
  name: ${config.name}
  namespace: ${config.namespace}
spec:
  type: ${config.type}
  ports:
  - port: ${config.port}
    targetPort: ${config.targetPort}
    protocol: TCP
  selector:
${Object.entries(config.selector)
  .map(([key, value]) => `    ${key}: ${value}`)
  .join('\n')}`
  }

  /**
   * Generate ingress YAML
   */
  generateIngress(config: K8sIngressConfig): string {
    const tls = config.tlsEnabled
      ? `
  tls:
  - hosts:
    - ${config.host}
    secretName: ${config.name}-tls`
      : ''

    const paths = config.paths
      .map(
        (p) => `    - path: ${p.path}
      pathType: ${p.pathType}
      backend:
        service:
          name: ${p.backend.service}
          port:
            number: ${p.backend.port}`
      )
      .join('\n')

    return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${config.name}
  namespace: ${config.namespace}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  rules:
  - host: ${config.host}
    http:
      paths:
${paths}${tls}`
  }

  /**
   * Generate stateful set YAML
   */
  generateStatefulSet(config: K8sStatefulSetConfig): string {
    const volumeMounts = config.volumeMounts
      .map((vm) => `      - name: ${vm.name}\n        mountPath: ${vm.mountPath}`)
      .join('\n')

    return `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${config.name}
  namespace: ${config.namespace}
spec:
  serviceName: ${config.serviceName}
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${config.name}
  template:
    metadata:
      labels:
        app: ${config.name}
    spec:
      containers:
      - name: ${config.name}
        image: ${config.image}:${config.imageTag}
        ports:
        - containerPort: 5432
          name: db
${volumeMounts}
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: ${config.storage.storageClass}
      resources:
        requests:
          storage: ${config.storage.size}`
  }

  /**
   * Generate namespace YAML
   */
  generateNamespace(name: string): string {
    return `apiVersion: v1
kind: Namespace
metadata:
  name: ${name}
  labels:
    managed-by: pi-builder`
  }
}

/**
 * Kubernetes Cluster Manager
 */
export class K8sClusterManager {
  private deployments: Map<string, string> = new Map() // name -> YAML
  private services: Map<string, string> = new Map()
  private ingresses: Map<string, string> = new Map()
  private statefulSets: Map<string, string> = new Map()
  private namespaces: Set<string> = new Set()

  /**
   * Add deployment
   */
  addDeployment(name: string, yaml: string): void {
    this.deployments.set(name, yaml)
    console.log(`📦 Deployment added: ${name}`)
  }

  /**
   * Add service
   */
  addService(name: string, yaml: string): void {
    this.services.set(name, yaml)
    console.log(`🔌 Service added: ${name}`)
  }

  /**
   * Add ingress
   */
  addIngress(name: string, yaml: string): void {
    this.ingresses.set(name, yaml)
    console.log(`🌐 Ingress added: ${name}`)
  }

  /**
   * Add stateful set
   */
  addStatefulSet(name: string, yaml: string): void {
    this.statefulSets.set(name, yaml)
    console.log(`💾 StatefulSet added: ${name}`)
  }

  /**
   * Create namespace
   */
  createNamespace(name: string): void {
    this.namespaces.add(name)
    console.log(`🏗️ Namespace created: ${name}`)
  }

  /**
   * Generate complete cluster manifest
   */
  generateManifest(): string {
    let manifest = ''

    // Add namespaces first
    for (const ns of this.namespaces) {
      const generator = new K8sDeploymentGenerator()
      manifest += generator.generateNamespace(ns) + '\n---\n'
    }

    // Add deployments
    for (const yaml of this.deployments.values()) {
      manifest += yaml + '\n---\n'
    }

    // Add services
    for (const yaml of this.services.values()) {
      manifest += yaml + '\n---\n'
    }

    // Add stateful sets
    for (const yaml of this.statefulSets.values()) {
      manifest += yaml + '\n---\n'
    }

    // Add ingresses
    for (const yaml of this.ingresses.values()) {
      manifest += yaml + '\n---\n'
    }

    return manifest
  }

  /**
   * Get deployment summary
   */
  getSummary(): {
    deployments: number
    services: number
    ingresses: number
    statefulSets: number
    namespaces: number
  } {
    return {
      deployments: this.deployments.size,
      services: this.services.size,
      ingresses: this.ingresses.size,
      statefulSets: this.statefulSets.size,
      namespaces: this.namespaces.size
    }
  }
}

/**
 * Production Cluster Setup
 */
export class ProductionClusterSetup {
  private generator: K8sDeploymentGenerator
  private manager: K8sClusterManager

  constructor() {
    this.generator = new K8sDeploymentGenerator()
    this.manager = new K8sClusterManager()
  }

  /**
   * Setup complete production cluster
   */
  async setupProductionCluster(domain: string): Promise<void> {
    console.log(`🚀 Setting up production cluster for ${domain}`)

    // Create namespaces
    this.manager.createNamespace('pi-builder')
    this.manager.createNamespace('monitoring')
    this.manager.createNamespace('ingress-nginx')

    // API Server
    const apiDeployment = this.generator.generateDeployment({
      name: 'pi-api-server',
      namespace: 'pi-builder',
      replicas: 3,
      image: 'pi-builder/api-server',
      imageTag: 'latest',
      port: 3000,
      resources: { cpu: '500m', memory: '512Mi' },
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://db:5432/pi_builder',
        REDIS_URL: 'redis://cache:6379'
      },
      healthCheck: {
        enabled: true,
        path: '/health',
        initialDelaySeconds: 10,
        periodSeconds: 10
      }
    })

    this.manager.addDeployment('pi-api-server', apiDeployment)

    // API Service
    const apiService = this.generator.generateService({
      name: 'pi-api-service',
      namespace: 'pi-builder',
      type: 'ClusterIP',
      port: 80,
      targetPort: 3000,
      selector: { app: 'pi-api-server' }
    })

    this.manager.addService('pi-api-service', apiService)

    // Database (PostgreSQL)
    const dbStatefulSet = this.generator.generateStatefulSet({
      name: 'postgres',
      namespace: 'pi-builder',
      serviceName: 'postgres-service',
      replicas: 1,
      image: 'postgres',
      imageTag: '15-alpine',
      storage: { size: '100Gi', storageClass: 'standard' },
      volumeMounts: [{ name: 'data', mountPath: '/var/lib/postgresql/data' }]
    })

    this.manager.addStatefulSet('postgres', dbStatefulSet)

    // Cache (Redis)
    const cacheDeployment = this.generator.generateDeployment({
      name: 'redis-cache',
      namespace: 'pi-builder',
      replicas: 1,
      image: 'redis',
      imageTag: 'alpine',
      port: 6379,
      resources: { cpu: '200m', memory: '256Mi' },
      env: {}
    })

    this.manager.addDeployment('redis-cache', cacheDeployment)

    // Ingress
    const ingress = this.generator.generateIngress({
      name: 'pi-ingress',
      namespace: 'pi-builder',
      host: domain,
      paths: [
        {
          path: '/api',
          pathType: 'Prefix',
          backend: { service: 'pi-api-service', port: 80 }
        }
      ],
      tlsEnabled: true,
      certIssuer: 'letsencrypt-prod'
    })

    this.manager.addIngress('pi-ingress', ingress)

    console.log(`✅ Production cluster setup complete`)
  }

  /**
   * Export manifest
   */
  exportManifest(): string {
    return this.manager.generateManifest()
  }

  /**
   * Get cluster summary
   */
  getClusterSummary(): any {
    return this.manager.getSummary()
  }
}
