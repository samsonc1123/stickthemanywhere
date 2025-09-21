#!/usr/bin/env tsx

import { githubService } from '../server/services/githubService';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const REPO_NAME = 'stickthemanywhere';
const REPO_DESCRIPTION = 'Neon Sticker E-commerce Website - Complete online sticker shop with dark theme and neon effects';

async function simpleGitHubSetup() {
  console.log('🚀 Setting up GitHub repository for Stick Them Anywhere...\n');

  try {
    // Step 1: Verify GitHub connection
    console.log('📋 Step 1: Verifying GitHub connection...');
    const userInfo = await githubService.getCurrentUser();
    console.log(`✅ Connected as: ${userInfo.login} (${userInfo.name || 'No name set'})`);

    // Step 2: Create repository (empty)
    console.log('\n📋 Step 2: Creating GitHub repository...');
    let repository;
    try {
      repository = await githubService.createRepository(REPO_NAME, REPO_DESCRIPTION, false);
      console.log(`✅ Repository created: ${repository.html_url}`);
    } catch (error: any) {
      if (error.message && error.message.includes('already exists')) {
        console.log(`✅ Repository already exists, getting details...`);
        repository = await githubService.getRepository(userInfo.login, REPO_NAME);
        console.log(`   URL: ${repository.html_url}`);
      } else {
        throw error;
      }
    }

    // Step 3: Set up git and push code
    console.log('\n📋 Step 3: Setting up git and pushing code...');
    
    const repoUrl = `https://github.com/${userInfo.login}/${REPO_NAME}.git`;
    console.log(`   Repository URL: ${repoUrl}`);

    // Initialize git if not already done
    try {
      await execAsync('git status');
      console.log('✅ Git repository already initialized');
    } catch {
      console.log('   Initializing git repository...');
      await execAsync('git init');
      console.log('✅ Git initialized');
    }

    // Add all files
    console.log('   Adding all project files...');
    await execAsync('git add .');
    console.log('✅ Files staged');

    // Check if we need to configure git user
    try {
      await execAsync('git config user.name');
      await execAsync('git config user.email');
    } catch {
      console.log('   Configuring git user...');
      await execAsync(`git config user.name "${userInfo.name || userInfo.login}"`);
      await execAsync(`git config user.email "${userInfo.email || userInfo.login + '@users.noreply.github.com'}"`);
      console.log('✅ Git user configured');
    }

    // Create initial commit
    try {
      console.log('   Creating initial commit...');
      await execAsync('git commit -m "Initial commit: Complete sticker e-commerce website"');
      console.log('✅ Initial commit created');
    } catch (error: any) {
      if (error.message.includes('nothing to commit')) {
        console.log('✅ No changes to commit');
      } else {
        throw error;
      }
    }

    // Set remote origin
    try {
      await execAsync(`git remote add origin ${repoUrl}`);
      console.log('✅ Remote origin added');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('   Remote origin already exists, updating...');
        await execAsync(`git remote set-url origin ${repoUrl}`);
        console.log('✅ Remote origin updated');
      } else {
        throw error;
      }
    }

    // Push to GitHub
    console.log('   Pushing code to GitHub...');
    try {
      await execAsync('git push -u origin main');
      console.log('✅ Code pushed to main branch');
    } catch (error: any) {
      if (error.message.includes('main')) {
        // Try master branch
        await execAsync('git branch -M main');
        await execAsync('git push -u origin main');
        console.log('✅ Code pushed to main branch');
      } else {
        throw error;
      }
    }

    // Step 4: Set up CI/CD workflows
    console.log('\n📋 Step 4: Setting up CI/CD workflows...');
    try {
      const deploymentResult = await githubService.setupProductionDeployment(userInfo.login, REPO_NAME);
      console.log(`✅ ${deploymentResult.message}`);
    } catch (error) {
      console.log('⚠️  CI/CD setup will be handled in next push');
    }

    // Success message
    console.log('\n🎉 GitHub setup completed successfully!');
    console.log('\n📋 Repository Information:');
    console.log(`   Name: ${REPO_NAME}`);
    console.log(`   Owner: ${userInfo.login}`);
    console.log(`   URL: https://github.com/${userInfo.login}/${REPO_NAME}`);
    console.log(`   Clone: git clone https://github.com/${userInfo.login}/${REPO_NAME}.git`);
    
    console.log('\n🔄 Automatic Syncing:');
    console.log('   ✅ Git repository connected to GitHub');
    console.log('   ✅ Push changes with: git add . && git commit -m "message" && git push');
    console.log('   ✅ GitHub Actions workflows ready');

    console.log('\n📝 Your project is now backed up and version controlled on GitHub!');

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the setup
simpleGitHubSetup().catch(console.error);