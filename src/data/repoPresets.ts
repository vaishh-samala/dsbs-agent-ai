import { PackageManager, RuntimeType } from '../types/sandbox';

export interface RepoPreset {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  branch: string;
  runtime: RuntimeType;
  runtimeVersion: string;
  packageManager: PackageManager;
  startCommand: string;
  testCommand: string;
  port: number;
  expectedOutcome: 'success' | 'failure';
  failureDetails?: {
    step: 'verification';
    title: 'Health check probe timed out on port 8080';
    message: 'Process started but failed to bind within 15000ms. Database connection refused on localhost:5432.';
    suggestedFix: 'Add MOCK_DATABASE=true to environment variables or provision a local SQLite fallback.';
  };
}

export const REPO_PRESETS: RepoPreset[] = [
  {
    id: 'nextjs-saas',
    name: 'Next.js 14 SaaS Starter',
    description: 'Full-stack TypeScript application with React Server Components',
    repoUrl: 'https://github.com/shadcn/taxonomy',
    branch: 'main',
    runtime: 'node',
    runtimeVersion: 'Node.js 20.14.0 LTS',
    packageManager: 'pnpm',
    startCommand: 'pnpm dev',
    testCommand: 'pnpm test -- --run',
    port: 3000,
    expectedOutcome: 'success',
  },
  {
    id: 'fastapi-backend',
    name: 'FastAPI Microservice',
    description: 'Modern asynchronous REST API with Pydantic and Uvicorn',
    repoUrl: 'https://github.com/tiangolo/fastapi-realworld-example',
    branch: 'main',
    runtime: 'python',
    runtimeVersion: 'Python 3.11.9',
    packageManager: 'poetry',
    startCommand: 'poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000',
    testCommand: 'poetry run pytest tests/ -v',
    port: 8000,
    expectedOutcome: 'success',
  },
  {
    id: 'express-api',
    name: 'Express Clean Architecture API',
    description: 'Node.js REST service with structured middleware and routes',
    repoUrl: 'https://github.com/goldbergyoni/nodebestpractices',
    branch: 'master',
    runtime: 'node',
    runtimeVersion: 'Node.js 20.14.0 LTS',
    packageManager: 'npm',
    startCommand: 'npm run start:dev',
    testCommand: 'npm test',
    port: 3001,
    expectedOutcome: 'success',
  },
  {
    id: 'broken-auth-service',
    name: 'Django API (Faulty Dependency Demo)',
    description: 'Demonstrates failure detection: broken native C-extension wheels',
    repoUrl: 'https://github.com/octocat/unstable-django-sandbox',
    branch: 'fix/native-builds',
    runtime: 'python',
    runtimeVersion: 'Python 3.12.3',
    packageManager: 'pip',
    startCommand: 'python manage.py runserver 0.0.0.0:8080',
    testCommand: 'pytest',
    port: 8080,
    expectedOutcome: 'failure',
    failureDetails: {
      step: 'verification',
      title: 'Health check probe timed out on port 8080',
      message: 'Process started but failed to bind within 15000ms. Database connection refused on localhost:5432.',
      suggestedFix: 'Add MOCK_DATABASE=true to environment variables or provision a local SQLite fallback.',
    },
  },
];
