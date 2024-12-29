import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import simpleGit from 'simple-git';
import readline from 'readline';

const cmd = new Command('new');

const execAsync = promisify(exec);

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}

async function getGitHubAuthor(): Promise<string> {
  try {
    const { stdout } = await execAsync('gh api user --jq .name');
    return stdout.trim();
  } catch (error) {
    console.warn('⚠️  Could not get GitHub user info. Make sure you are logged in with `gh auth login`');
    return 'Unknown';
  }
}

function validateHeader(content: string): boolean {
  const lines = content.split('\n');
  if (lines[0] !== '---') return false;
  
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex === -1) return false;
  
  const headerLines = lines.slice(1, endIndex);
  const requiredFields = ['name', 'namespace', 'version', 'author', 'description', 'created'];
  
  for (const field of requiredFields) {
    if (!headerLines.some(line => line.startsWith(`${field}:`))) {
      console.error(`❌ Missing required field: ${field}`);
      return false;
    }
  }
  
  return true;
}

cmd
  .requiredOption('--namespace <namespace>', 'Prompt namespace')
  .requiredOption('--name <name>', 'Prompt name')
  .requiredOption('--version <version>', 'Prompt version')
  .requiredOption('--description <description>', 'Prompt description')
  .option('--author <author>', 'Author name (defaults to GitHub user)')
  .option('--tags <tags>', 'Comma-separated tags (e.g. "ai,openapi,conversion")')
  .option('--dry-run', 'Create prompt locally without pushing to git')
  .action(async ({ namespace, name, version, description, author, tags, dryRun }) => {
    const configPath = join(homedir(), '.config', 'promptdock', 'config.json');
    
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const repoPath = config.local;
      
      // Get author from GitHub if not provided
      const finalAuthor = author || await getGitHubAuthor();
      
      const sanitizedName = sanitizeFilename(name);
      const promptDir = join(repoPath, namespace);
      const promptFile = join(promptDir, `${sanitizedName}-${version}.md`);
      
      // Create directory if it doesn't exist
      mkdirSync(promptDir, { recursive: true });
      
      // Create frontmatter
      const today = new Date().toISOString().split('T')[0];
      const tagsArray = tags ? tags.split(',').map((tag: string) => tag.trim()) : [];
      const frontmatter = `---
name: ${sanitizedName}
namespace: ${namespace}
version: ${version}
author: ${finalAuthor}
description: ${description}
created: ${today}${tagsArray.length > 0 ? `
tags: [${tagsArray.map((tag: string) => `"${tag}"`).join(', ')}]` : ''}
---

`;
      
      // Create temporary file for editing (without header)
      const tempContent = '# Write your prompt content here\n\n';
      writeFileSync(promptFile, tempContent);
      
      console.log(`📝 Created prompt: ${promptFile}`);
      
      // Open editor
      const editor = process.env.EDITOR || 'nano';
      const child = spawn(editor, [promptFile], { 
        stdio: 'inherit' 
      });
      
      child.on('close', async (code) => {
        if (code !== 0) {
          console.log('❌ Editor exited with error');
          return;
        }
        
        // Read the edited content and combine with header
        const editedContent = readFileSync(promptFile, 'utf-8');
        const finalContent = frontmatter + editedContent;
        
        // Write the final content with header
        writeFileSync(promptFile, finalContent);
        
        // Validate header
        if (!validateHeader(finalContent)) {
          console.error('❌ Invalid header format. Please fix and try again.');
          return;
        }
        
        console.log('✅ Header validation passed!');
        
        if (dryRun) {
          console.log('🔍 Dry run: Prompt created locally without pushing to git');
          return;
        }
        
        // Ask if user wants to submit
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>((resolve) => {
          rl.question('🚀 Do you want to commit and push this prompt? (y/N): ', resolve);
        });
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          rl.close();
          const git = simpleGit(repoPath);
          const relativeFile = join(namespace, `${sanitizedName}-${version}.md`);
          
          await git.add(relativeFile);
          await git.commit(`Add prompt: ${namespace}/${sanitizedName}`);
          await git.push('origin', 'main');
          
          console.log('✅ Prompt committed and pushed successfully!');
        } else {
          console.log('📝 Prompt saved locally only');
          
          // Ask if they want to delete it locally
          const deleteAnswer = await new Promise<string>((resolve) => {
            rl.question('🗑️  Do you want to delete this prompt locally? (y/N): ', resolve);
          });
          rl.close();
          
          if (deleteAnswer.toLowerCase() === 'y' || deleteAnswer.toLowerCase() === 'yes') {
            const fs = await import('fs');
            fs.unlinkSync(promptFile);
            console.log('🗑️  Prompt deleted locally.');
          }
        }
      });
      
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        console.error('❌ No configuration found. Run "promptdock init" first.');
      } else {
        console.error('❌ Failed to create prompt:', error instanceof Error ? error.message : String(error));
      }
    }
  });

export default cmd;