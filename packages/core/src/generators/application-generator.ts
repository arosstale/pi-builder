import { BackendGenerator, BackendSpec } from './backend-generator'
import { FrontendGenerator, FrontendSpec } from './frontend-generator'

export interface ApplicationSpec {
  name: string
  description: string
  version?: string
  backend: BackendSpec
  frontend: FrontendSpec
}

export interface GeneratedApplication {
  name: string
  version: string
  backend: {
    code: string
    framework: string
    language: string
  }
  frontend: {
    code: string
    framework: string
    language: string
  }
  manifest: ApplicationManifest
  timestamp: string
}

export interface ApplicationManifest {
  name: string
  version: string
  description: string
  generatedAt: string
  components: {
    backend: string
    frontend: string
  }
  instructions: string[]
  deploymentSteps: string[]
}

export class ApplicationGenerator {
  private backendGen: BackendGenerator
  private frontendGen: FrontendGenerator

  constructor() {
    this.backendGen = new BackendGenerator()
    this.frontendGen = new FrontendGenerator()
  }

  async generate(spec: ApplicationSpec): Promise<GeneratedApplication> {
    console.log(`🚀 Generating application: ${spec.name}`)
    console.log(`📝 Description: ${spec.description}`)

    // Generate backend
    console.log('\n📝 Generating backend...')
    const backend = await this.backendGen.generate(spec.backend)
    console.log('✅ Backend generated')

    // Generate frontend
    console.log('\n📝 Generating frontend...')
    const frontend = await this.frontendGen.generate(spec.frontend)
    console.log('✅ Frontend generated')

    // Create manifest
    const manifest = this.createManifest(spec)
    console.log('✅ Manifest created')

    console.log(`\n✨ Application generation complete: ${spec.name}`)

    return {
      name: spec.name,
      version: spec.version || '1.0.0',
      backend: {
        code: backend,
        framework: spec.backend.framework,
        language: 'python'
      },
      frontend: {
        code: frontend,
        framework: spec.frontend.framework,
        language: 'typescript'
      },
      manifest,
      timestamp: new Date().toISOString()
    }
  }

  private createManifest(spec: ApplicationSpec): ApplicationManifest {
    return {
      name: spec.name,
      version: spec.version || '1.0.0',
      description: spec.description,
      generatedAt: new Date().toISOString(),
      components: {
        backend: spec.backend.framework,
        frontend: spec.frontend.framework
      },
      instructions: [
        '1. Install backend dependencies:',
        '   cd backend && pip install -r requirements.txt',
        '',
        '2. Install frontend dependencies:',
        '   cd frontend && npm install',
        '',
        '3. Configure environment variables:',
        '   cp .env.example .env',
        '',
        '4. Initialize database:',
        '   python manage.py migrate',
        '',
        '5. Start backend:',
        '   python manage.py runserver',
        '',
        '6. Start frontend:',
        '   npm start'
      ],
      deploymentSteps: [
        '1. Build frontend: npm run build',
        '2. Collect static files: python manage.py collectstatic',
        '3. Deploy to production server',
        '4. Configure reverse proxy',
        '5. Set up SSL certificates',
        '6. Configure monitoring'
      ]
    }
  }

  async generateMultipleVersions(spec: ApplicationSpec, frameworks: string[]): Promise<GeneratedApplication[]> {
    const applications: GeneratedApplication[] = []

    for (const framework of frameworks) {
      const frameworkSpec = {
        ...spec,
        frontend: {
          ...spec.frontend,
          framework: framework as 'react' | 'vue' | 'svelte'
        }
      }

      const app = await this.generate(frameworkSpec)
      applications.push(app)
    }

    return applications
  }
}
