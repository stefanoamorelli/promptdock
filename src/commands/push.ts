import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname, resolve } from 'path';
import { homedir } from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import simpleGit from 'simple-git';
import readline from 'readline';

const cmd = new Command('push');
const execAsync = promisify(exec);

interface FoundFile {
  path: string;
  type: 'claude' | 'cursor';
  name: string;
  description: string;
  content: string;
  size: number;
}

async function getGitHubAuthor(): Promise<string> {
  try {
    const { stdout } = await execAsync('gh api user --jq .name');
    return stdout.trim();
  } catch (error) {
    return 'Unknown';
  }
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}

function detectFileType(filePath: string, content: string): 'claude' | 'cursor' {
  const fileName = basename(filePath).toLowerCase();
  const ext = extname(filePath).toLowerCase();
  
  // Claude patterns
  if (fileName === 'claude.md' || fileName === 'claude.local.md' || ext === '.claude') {
    return 'claude';
  }
  
  // Cursor patterns
  if (fileName === '.cursorrules' || ext === '.cursorrules' || ext === '.mdc') {
    return 'cursor';
  }
  
  // Content-based detection
  if (content.includes('.cursorrules') || content.includes('cursor') || 
      content.includes('code_style') || content.includes('ai_reasoning')) {
    return 'cursor';
  }
  
  // Default to claude for markdown
  return 'claude';
}

function extractTitle(content: string, filePath: string, fileType: 'claude' | 'cursor'): string {
  const lines = content.split('\n');
  
  // Check YAML frontmatter first
  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---' || lines[i] === '...') break;
      if (lines[i].startsWith('title:')) {
        return lines[i].substring(6).trim().replace(/['"]/g, '');
      }
    }
  }
  
  // Look for first heading
  const firstHeading = lines.find(line => line.startsWith('#'));
  if (firstHeading) {
    return firstHeading.replace(/^#+\s*/, '').trim();
  }
  
  // Fallback based on file type
  if (fileType === 'cursor') {
    return 'cursor-rules';
  }
  
  // Use filename
  const fileName = basename(filePath, extname(filePath));
  return fileName === 'claude' ? 'claude-context' : fileName;
}

function extractDescription(content: string, fileType: 'claude' | 'cursor'): string {
  const lines = content.split('\n');
  
  // Check YAML frontmatter
  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---' || lines[i] === '...') break;
      if (lines[i].startsWith('description:')) {
        return lines[i].substring(12).trim().replace(/['"]/g, '');
      }
    }
  }
  
  // Look for first non-empty paragraph after headings
  let foundContent = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#') || trimmed.startsWith('---')) {
      foundContent = true;
      continue;
    }
    if (foundContent && trimmed.length > 10) {
      return trimmed.substring(0, 100) + (trimmed.length > 100 ? '...' : '');
    }
  }
  
  return fileType === 'cursor' ? 'Cursor AI rules and guidelines' : 'Claude context and instructions';
}

function scanDirectory(dir: string, maxDepth: number = 3, currentDepth: number = 0): FoundFile[] {
  const files: FoundFile[] = [];
  
  if (currentDepth >= maxDepth) return files;
  
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const itemPath = join(dir, item);
      const stat = statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Skip common directories that won't have prompt files
        if (['node_modules', '.git', 'dist', 'build', '.next', 'target'].includes(item)) {
          continue;
        }
        files.push(...scanDirectory(itemPath, maxDepth, currentDepth + 1));
      } else if (stat.isFile()) {
        const fileName = basename(item).toLowerCase();
        const ext = extname(item).toLowerCase();
        
        // Check for Claude files
        if (fileName === 'claude.md' || fileName === 'claude.local.md' || ext === '.claude') {
          const content = readFileSync(itemPath, 'utf-8');
          const type = 'claude';
          files.push({
            path: itemPath,
            type,
            name: extractTitle(content, itemPath, type),
            description: extractDescription(content, type),
            content,
            size: stat.size
          });
        }
        // Check for Cursor files
        else if (fileName === '.cursorrules' || ext === '.cursorrules' || ext === '.mdc') {
          const content = readFileSync(itemPath, 'utf-8');
          const type = 'cursor';
          files.push({
            path: itemPath,
            type,
            name: extractTitle(content, itemPath, type),
            description: extractDescription(content, type),
            content,
            size: stat.size
          });
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return files;
}

function formatFileTable(files: FoundFile[]): void {
  if (files.length === 0) {
    console.log('📭 No Claude or Cursor files found.');
    return;
  }
  
  // Group by type
  const claudeFiles = files.filter(f => f.type === 'claude');
  const cursorFiles = files.filter(f => f.type === 'cursor');
  
  console.log(`🔍 Found ${files.length} files:`);
  
  if (claudeFiles.length > 0) {
    console.log(`\n📄 Claude files (${claudeFiles.length}):`);
    for (const file of claudeFiles) {
      console.log(`   • ${file.name} - ${file.description}`);
      console.log(`     ${file.path} (${(file.size / 1024).toFixed(1)}KB)`);
    }
  }
  
  if (cursorFiles.length > 0) {
    console.log(`\n🎯 Cursor files (${cursorFiles.length}):`);
    for (const file of cursorFiles) {
      console.log(`   • ${file.name} - ${file.description}`);
      console.log(`     ${file.path} (${(file.size / 1024).toFixed(1)}KB)`);
    }
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
      return false;
    }
  }
  
  return true;
}

cmd
  .option('--dir <directory>', 'Directory to scan (default: current directory)')
  .option('--depth <number>', 'Maximum scan depth (default: 3)', '3')
  .option('--namespace <namespace>', 'Target namespace (e.g. web, be, mobile)')
  .option('--dry-run', 'Show what would be pushed without actually pushing')
  .action(async ({ dir, depth, namespace, dryRun }) => {
    try {
      const scanDir = dir ? resolve(dir) : process.cwd();
      const maxDepth = parseInt(depth);
      
      console.log(`🔍 Scanning ${scanDir} (depth: ${maxDepth})...`);
      
      // Scan for files
      const foundFiles = scanDirectory(scanDir, maxDepth);
      
      formatFileTable(foundFiles);
      
      if (foundFiles.length === 0) {
        return;
      }
      
      if (dryRun) {
        console.log('\n🔍 Dry run: Nothing was actually pushed');
        return;
      }
      
      // Ask for namespace if not provided
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      let targetNamespace = namespace;
      if (!targetNamespace) {
        targetNamespace = await new Promise<string>((resolve) => {
          rl.question('\n📂 Enter namespace for these prompts (e.g. web, be, mobile): ', resolve);
        });
        
        if (!targetNamespace.trim()) {
          rl.close();
          console.log('❌ Namespace is required.');
          return;
        }
        targetNamespace = targetNamespace.trim();
      }
      
      const answer = await new Promise<string>((resolve) => {
        rl.question(`\n❓ Do you want to push all ${foundFiles.length} files to namespace "${targetNamespace}"? (y/N): `, resolve);
      });
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        rl.close();
        console.log('❌ Push cancelled.');
        return;
      }
      
      // Get config
      const configPath = join(homedir(), '.config', 'promptdock', 'config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const repoPath = config.local;
      const author = await getGitHubAuthor();
      const today = new Date().toISOString().split('T')[0];
      
      console.log('\n📦 Pushing files...');
      
      const pushedFiles: string[] = [];
      
      for (const file of foundFiles) {
        const sanitizedName = sanitizeFilename(file.name);
        const promptDir = join(repoPath, targetNamespace);
        const outputPath = join(promptDir, `${sanitizedName}.md`);
        
        // Create directory
        mkdirSync(promptDir, { recursive: true });
        
        // Check if exists
        if (existsSync(outputPath)) {
          console.log(`⚠️  Skipping ${file.name} - already exists`);
          continue;
        }
        
        // Create tags based on type and add "pushed" tag
        const tags = file.type === 'claude' 
          ? ['claude', 'context', 'pushed']
          : ['cursor', 'rules', 'pushed'];
        
        // Create prompt content
        const finalContent = `---
name: ${sanitizedName}
namespace: ${targetNamespace}
version: 1.0.0
author: ${author}
description: ${file.description}
created: ${today}
tags: [${tags.map(tag => `"${tag}"`).join(', ')}]
---

${file.content}`;
        
        // Write file
        writeFileSync(outputPath, finalContent);
        
        // Validate
        if (!validateHeader(finalContent)) {
          console.log(`❌ Failed to create valid header for ${file.name}`);
          continue;
        }
        
        console.log(`✅ Pushed: ${targetNamespace}/${sanitizedName}`);
        pushedFiles.push(join(targetNamespace, `${sanitizedName}.md`));
      }
      
      if (pushedFiles.length === 0) {
        console.log('😞 No files were pushed');
        rl.close();
        return;
      }
      
      // Ask about git commit
      const commitAnswer = await new Promise<string>((resolve) => {
        rl.question(`🚀 Do you want to commit and push these ${pushedFiles.length} files? (y/N): `, resolve);
      });
      rl.close();
      
      if (commitAnswer.toLowerCase() === 'y' || commitAnswer.toLowerCase() === 'yes') {
        const git = simpleGit(repoPath);
        
        // Add all files
        for (const file of pushedFiles) {
          await git.add(file);
        }
        
        await git.commit(`Push ${pushedFiles.length} discovered prompts to ${targetNamespace}`);
        await git.push('origin', 'main');
        
        console.log(`✅ ${pushedFiles.length} prompts committed and pushed successfully!`);
      } else {
        console.log(`📝 ${pushedFiles.length} prompts pushed locally only`);
      }
      
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT' && (error as any).path?.includes('config.json')) {
        console.error('❌ No configuration found. Run "promptdock init" first.');
      } else {
        console.error('❌ Failed to push files:', error instanceof Error ? error.message : String(error));
      }
    }
  });

export default cmd;