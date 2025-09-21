#!/usr/bin/env tsx

import { githubService } from '../server/services/githubService';
import path from 'path';

const REPO_NAME = 'stickthemanywhere';
const REPO_DESCRIPTION = 'Neon Sticker E-commerce Website - Complete online sticker shop with dark theme and neon effects';
const OWNER_USERNAME = 'samsonc1123';

async function setupGitHubRepository() {
  console.log('🚀 Setting up GitHub repository for Stick Them Anywhere...\n');

  try {
    // Step 1: Get current user info to confirm connection
    console.log('📋 Step 1: Verifying GitHub connection...');
    const userInfo = await githubService.getCurrentUser();
    console.log(`✅ Connected as: ${userInfo.login} (${userInfo.name || 'No name set'})`);
    console.log(`   Profile: ${userInfo.html_url}\n`);

    if (userInfo.login !== OWNER_USERNAME) {
      console.log(`⚠️  Warning: Connected as ${userInfo.login}, expected ${OWNER_USERNAME}`);
      console.log('   Continuing with the connected account...\n');
    }

    // Step 2: Check if repository already exists
    console.log('📋 Step 2: Checking if repository exists...');
    const existingRepo = await githubService.getRepository(userInfo.login, REPO_NAME);
    
    if (existingRepo) {
      console.log(`✅ Repository ${REPO_NAME} already exists at: ${existingRepo.html_url}`);
      console.log(`   Created: ${existingRepo.created_at}`);
      console.log(`   Updated: ${existingRepo.updated_at}\n`);
      
      // Ask if we should reinitialize
      console.log('📋 Step 3: Initializing repository with current code...');
      const initResult = await githubService.initializeRepository(userInfo.login, REPO_NAME);
      console.log(`✅ ${initResult.message}`);
      console.log(`   Files uploaded: ${initResult.filesUploaded}`);
      if (initResult.filesFailed > 0) {
        console.log(`   Files failed: ${initResult.filesFailed}`);
      }
    } else {
      // Step 3: Create new repository with all code
      console.log('📋 Step 3: Creating new repository with all project code...');
      const result = await githubService.createRepositoryWithCode(
        REPO_NAME, 
        REPO_DESCRIPTION, 
        false, // public repository
        process.cwd()
      );
      
      console.log(`✅ Repository created successfully!`);
      console.log(`   URL: ${result.repository.html_url}`);
      console.log(`   Clone URL: ${result.repository.clone_url}`);
      console.log(`   SSH URL: ${result.repository.ssh_url}`);
      console.log(`   Files uploaded: ${result.initialization.filesUploaded}`);
      if (result.initialization.filesFailed > 0) {
        console.log(`   Files failed: ${result.initialization.filesFailed}`);
      }
    }

    // Step 4: Set up production deployment and CI/CD
    console.log('\n📋 Step 4: Setting up production deployment and CI/CD...');
    const deploymentResult = await githubService.setupProductionDeployment(userInfo.login, REPO_NAME);
    console.log(`✅ ${deploymentResult.message}`);
    console.log(`   GitHub Actions workflow: ${deploymentResult.details.workflow.message}`);
    console.log(`   Dockerfile: ${deploymentResult.details.dockerfile.message}`);
    console.log(`   Docker ignore: ${deploymentResult.details.dockerignore.message}`);

    // Step 5: Display final information
    console.log('\n🎉 GitHub setup completed successfully!');
    console.log('\n📋 Repository Information:');
    console.log(`   Name: ${REPO_NAME}`);
    console.log(`   Owner: ${userInfo.login}`);
    console.log(`   URL: https://github.com/${userInfo.login}/${REPO_NAME}`);
    console.log(`   Clone: git clone https://github.com/${userInfo.login}/${REPO_NAME}.git`);
    
    console.log('\n🔄 Automatic Syncing:');
    console.log('   ✅ GitHub Actions CI/CD pipeline configured');
    console.log('   ✅ Automatic builds on push to main branch');
    console.log('   ✅ Deployment workflow ready');
    console.log('   ✅ Security audit included');

    console.log('\n📝 Next Steps:');
    console.log('   1. All your code is now backed up on GitHub');
    console.log('   2. Future changes will trigger automatic builds');
    console.log('   3. Check the Actions tab in your repository for build status');
    console.log('   4. Set up GitHub Pages or connect to Vercel/Netlify for hosting');
    
    console.log('\n💡 Tips:');
    console.log('   • Use git commands locally for version control');
    console.log('   • Push changes with: git add . && git commit -m "message" && git push');
    console.log('   • Check workflow status at: https://github.com/' + userInfo.login + '/' + REPO_NAME + '/actions');

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    
    if (error.message.includes('GitHub not connected')) {
      console.log('\n🔧 Troubleshooting:');
      console.log('   1. Make sure you\'ve connected your GitHub account in Replit');
      console.log('   2. Check that the GitHub integration has proper permissions');
      console.log('   3. Try disconnecting and reconnecting your GitHub account');
    }
    
    if (error.message.includes('rate limit')) {
      console.log('\n⏱️  Rate limit reached. Please wait a few minutes and try again.');
    }
    
    process.exit(1);
  }
}

// Run the setup
setupGitHubRepository().catch(console.error);

export { setupGitHubRepository };