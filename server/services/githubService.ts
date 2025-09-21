import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export class GitHubService {
  
  async getCurrentUser() {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.rest.users.getAuthenticated();
    return data;
  }

  async createRepository(name: string, description?: string, isPrivate: boolean = false) {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: false, // Don't create README since we have existing code
    });
    return data;
  }

  async getUserRepositories(page: number = 1, perPage: number = 30) {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      page,
      per_page: perPage,
      sort: 'updated',
      direction: 'desc'
    });
    return data;
  }

  async getRepository(owner: string, repo: string) {
    const octokit = await getUncachableGitHubClient();
    try {
      const { data } = await octokit.rest.repos.get({
        owner,
        repo
      });
      return data;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createWebhook(owner: string, repo: string, config: any) {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.rest.repos.createWebhook({
      owner,
      repo,
      name: 'web',
      config,
      events: ['push', 'pull_request'],
      active: true
    });
    return data;
  }

  async getWorkflowRuns(owner: string, repo: string) {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 10
    });
    return data;
  }

  async createDeploymentWorkflow(owner: string, repo: string) {
    const octokit = await getUncachableGitHubClient();
    
    const workflowContent = `name: CI/CD Pipeline

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

env:
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest
    name: Test and Build
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Type check
      run: npx tsc --noEmit
    
    - name: Lint code
      run: npm run lint --if-present
    
    - name: Run tests
      run: npm test --if-present
    
    - name: Build application
      run: npm run build --if-present
    
    - name: Upload build artifacts
      if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
      uses: actions/upload-artifact@v4
      with:
        name: build-files
        path: |
          dist/
          build/
          .next/
        retention-days: 7

  deploy:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    name: Deploy to Production
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Download build artifacts
      uses: actions/download-artifact@v4
      with:
        name: build-files
    
    - name: Deploy to GitHub Pages
      if: contains(github.repository, 'frontend') || contains(github.repository, 'static')
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: \${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
    
    - name: Notify deployment status
      run: |
        echo "🚀 Deployment completed successfully!"
        echo "Repository: \${{ github.repository }}"
        echo "Commit: \${{ github.sha }}"
        echo "Branch: \${{ github.ref_name }}"

  security:
    runs-on: ubuntu-latest
    name: Security Audit
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run security audit
      run: npm audit --audit-level moderate
      continue-on-error: true
    
    - name: Check for vulnerabilities
      run: npx audit-ci --moderate
      continue-on-error: true
`;

    try {
      // Create .github/workflows directory structure
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: '.github/workflows/deploy.yml',
        message: 'Add deployment workflow',
        content: Buffer.from(workflowContent).toString('base64'),
      });
      return { success: true, message: 'Deployment workflow created' };
    } catch (error: any) {
      if (error.status === 422) {
        // File already exists, update it
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: '.github/workflows/deploy.yml'
        });
        
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: '.github/workflows/deploy.yml',
          message: 'Update deployment workflow',
          content: Buffer.from(workflowContent).toString('base64'),
          sha: (fileData as any).sha
        });
        return { success: true, message: 'Deployment workflow updated' };
      }
      throw error;
    }
  }

  async getCommits(owner: string, repo: string, page: number = 1) {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      page,
      per_page: 10
    });
    return data;
  }

  async getBranches(owner: string, repo: string) {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.rest.repos.listBranches({
      owner,
      repo
    });
    return data;
  }

  async createIssue(owner: string, repo: string, title: string, body?: string, labels?: string[]) {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels
    });
    return data;
  }

  async getIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state,
      per_page: 20
    });
    return data;
  }

  // Repository initialization methods
  private async readProjectFiles(rootPath: string): Promise<{ path: string; content: string; }[]> {
    const files: { path: string; content: string; }[] = [];
    const projectRoot = path.resolve(rootPath);

    // Files and directories to exclude from upload
    const excludePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.env',
      '.env.local',
      '.env.production',
      'tmp',
      'logs',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '.replit',
      'replit.nix',
      '.cache',
      '.vscode',
      '.idea',
      'coverage'
    ];

    const shouldExclude = (filePath: string): boolean => {
      const relativePath = path.relative(projectRoot, filePath);
      return excludePatterns.some(pattern => {
        if (pattern.includes('*')) {
          return new RegExp(pattern.replace('*', '.*')).test(relativePath);
        }
        return relativePath.includes(pattern) || relativePath.startsWith(pattern);
      });
    };

    const readDirectory = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (shouldExclude(fullPath)) {
            continue;
          }

          if (entry.isDirectory()) {
            await readDirectory(fullPath);
          } else if (entry.isFile()) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const relativePath = path.relative(projectRoot, fullPath);
              files.push({
                path: relativePath.replace(/\\/g, '/'), // Use forward slashes for GitHub
                content
              });
            } catch (error) {
              // Skip binary files or files that can't be read as text
              console.warn(`Skipping file ${fullPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
      }
    };

    await readDirectory(projectRoot);
    return files;
  }

  async initializeRepository(owner: string, repo: string, projectPath: string = process.cwd()) {
    const octokit = await getUncachableGitHubClient();
    
    try {
      // Read all project files
      const projectFiles = await this.readProjectFiles(projectPath);
      
      if (projectFiles.length === 0) {
        throw new Error('No files found to upload to repository');
      }

      // Create a commit with all files
      const files: { [key: string]: string } = {};
      projectFiles.forEach(file => {
        files[file.path] = file.content;
      });

      // Get repository info to determine default branch
      const { data: repoData } = await octokit.rest.repos.get({
        owner,
        repo
      });

      const defaultBranch = repoData.default_branch || 'main';

      // Create initial commit with all files
      const commitFiles = Object.entries(files).map(([path, content]) => ({
        path,
        content: Buffer.from(content).toString('base64')
      }));

      // Upload files in batches to avoid API limits
      const batchSize = 10;
      const uploadResults = [];

      for (let i = 0; i < commitFiles.length; i += batchSize) {
        const batch = commitFiles.slice(i, i + batchSize);
        
        const uploadPromises = batch.map(async (file) => {
          try {
            const result = await octokit.rest.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: file.path,
              message: `Add ${file.path}`,
              content: file.content,
              branch: defaultBranch
            });
            return { success: true, path: file.path, result };
          } catch (error: any) {
            console.error(`Failed to upload ${file.path}:`, error);
            return { success: false, path: file.path, error: error.message };
          }
        });

        const batchResults = await Promise.allSettled(uploadPromises);
        uploadResults.push(...batchResults.map(result => 
          result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
        ));

        // Small delay between batches to respect rate limits
        if (i + batchSize < commitFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successful = uploadResults.filter(r => r.success).length;
      const failed = uploadResults.filter(r => !r.success).length;

      return {
        success: true,
        message: `Repository initialized successfully. Uploaded ${successful} files${failed > 0 ? `, ${failed} failed` : ''}.`,
        filesUploaded: successful,
        filesFailed: failed,
        details: uploadResults
      };

    } catch (error: any) {
      console.error('Repository initialization error:', error);
      throw new Error(`Failed to initialize repository: ${error.message}`);
    }
  }

  async createRepositoryWithCode(name: string, description?: string, isPrivate: boolean = false, projectPath: string = process.cwd()) {
    try {
      // First create the repository
      const repository = await this.createRepository(name, description, isPrivate);
      
      // Wait a moment for repository to be fully created
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Then initialize it with project code
      const initResult = await this.initializeRepository(repository.owner.login, repository.name, projectPath);
      
      return {
        repository,
        initialization: initResult
      };
    } catch (error: any) {
      throw new Error(`Failed to create repository with code: ${error.message}`);
    }
  }

  async createDockerfile(owner: string, repo: string) {
    const octokit = await getUncachableGitHubClient();
    
    const dockerfileContent = `# Use the official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 5000

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory to the nodejs user
USER nextjs

# Command to run the application
CMD ["npm", "start"]
`;

    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'Dockerfile',
        message: 'Add production Dockerfile',
        content: Buffer.from(dockerfileContent).toString('base64'),
      });
      return { success: true, message: 'Dockerfile created successfully' };
    } catch (error: any) {
      if (error.status === 422) {
        // File already exists, update it
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: 'Dockerfile'
        });
        
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: 'Dockerfile',
          message: 'Update production Dockerfile',
          content: Buffer.from(dockerfileContent).toString('base64'),
          sha: (fileData as any).sha
        });
        return { success: true, message: 'Dockerfile updated successfully' };
      }
      throw error;
    }
  }

  async createDockerIgnore(owner: string, repo: string) {
    const octokit = await getUncachableGitHubClient();
    
    const dockerignoreContent = `node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.DS_Store
.git
.gitignore
README.md
Dockerfile
.dockerignore
coverage
.nyc_output
.cache
dist
build
.vscode
.idea
*.log
tmp
logs
*.tgz
*.tar.gz
.replit
replit.nix
`;

    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: '.dockerignore',
        message: 'Add .dockerignore file',
        content: Buffer.from(dockerignoreContent).toString('base64'),
      });
      return { success: true, message: '.dockerignore created successfully' };
    } catch (error: any) {
      if (error.status === 422) {
        // File already exists, update it
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: '.dockerignore'
        });
        
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: '.dockerignore',
          message: 'Update .dockerignore file',
          content: Buffer.from(dockerignoreContent).toString('base64'),
          sha: (fileData as any).sha
        });
        return { success: true, message: '.dockerignore updated successfully' };
      }
      throw error;
    }
  }

  async setupProductionDeployment(owner: string, repo: string) {
    try {
      const results = await Promise.all([
        this.createDeploymentWorkflow(owner, repo),
        this.createDockerfile(owner, repo),
        this.createDockerIgnore(owner, repo)
      ]);

      return {
        success: true,
        message: 'Production deployment setup completed',
        details: {
          workflow: results[0],
          dockerfile: results[1],
          dockerignore: results[2]
        }
      };
    } catch (error: any) {
      throw new Error(`Failed to setup production deployment: ${error.message}`);
    }
  }
}

export const githubService = new GitHubService();