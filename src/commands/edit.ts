import { Command } from 'commander';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import simpleGit from 'simple-git';
import readline from 'readline';

const cmd = new Command('edit');

interface PromptInfo {
  name: string;
  namespace: string;
  version: string;
  author: string;
  description: string;
  created: string;
  tags: string[];
  file: string;
}

function parsePromptFile(filePath: string): PromptInfo | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Find frontmatter boundaries
    let startIndex = -1;
    let endIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (startIndex === -1) {
          startIndex = i;
        } else {
          endIndex = i;
          break;
        }
      }
    }
    
    if (startIndex === -1 || endIndex === -1) {
      return null;
    }
    
    // Parse frontmatter
    const frontmatter = lines.slice(startIndex + 1, endIndex);
    const metadata: any = {};
    
    for (const line of frontmatter) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        if (match[1] === 'tags') {
          try {
            metadata[match[1]] = JSON.parse(match[2]);
          } catch {
            metadata[match[1]] = [];
          }
        } else {
          metadata[match[1]] = match[2];
        }
      }
    }
    
    return {
      name: metadata.name || 'Unknown',
      namespace: metadata.namespace || 'Unknown',
      version: metadata.version || 'Unknown',
      author: metadata.author || 'Unknown',
      description: metadata.description || 'No description',
      created: metadata.created || 'Unknown',
      tags: metadata.tags || [],
      file: filePath
    };
  } catch (error) {
    return null;
  }
}

function findPrompts(baseDir: string): PromptInfo[] {
  const prompts: PromptInfo[] = [];
  
  try {
    const namespaces = readdirSync(baseDir).filter(item => {
      const itemPath = join(baseDir, item);
      return statSync(itemPath).isDirectory();
    });
    
    for (const namespace of namespaces) {
      const namespaceDir = join(baseDir, namespace);
      const files = readdirSync(namespaceDir).filter(file => file.endsWith('.md'));
      
      for (const file of files) {
        const filePath = join(namespaceDir, file);
        const promptInfo = parsePromptFile(filePath);
        if (promptInfo) {
          prompts.push(promptInfo);
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or other error
  }
  
  return prompts;
}

function parsePromptSpec(promptArg: string): { namespace?: string, name: string, version?: string } {
  // Format: name, namespace/name, name@version, namespace/name@version
  let path = promptArg;
  let version: string | undefined;
  
  const atIndex = promptArg.lastIndexOf('@');
  if (atIndex !== -1) {
    path = promptArg.substring(0, atIndex);
    version = promptArg.substring(atIndex + 1);
  }
  
  if (path.includes('/')) {
    const [namespace, name] = path.split('/');
    return { namespace, name, version };
  } else {
    return { name: path, version };
  }
}

function getLatestVersion(prompts: PromptInfo[]): PromptInfo {
  return prompts.sort((a, b) => {
    const aVersion = parseVersion(a.version);
    const bVersion = parseVersion(b.version);
    
    if (aVersion.major !== bVersion.major) return bVersion.major - aVersion.major;
    if (aVersion.minor !== bVersion.minor) return bVersion.minor - aVersion.minor;
    return bVersion.patch - aVersion.patch;
  })[0];
}

function parseVersion(version: string): { major: number, minor: number, patch: number } {
  const parts = version.split('.').map(n => parseInt(n) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

function bumpVersion(currentVersion: string, bumpType: 'major' | 'minor' | 'patch'): string {
  const parts = currentVersion.split('.').map(Number);
  if (parts.length !== 3) {
    return '1.0.0'; // Default if invalid version
  }
  
  const [major, minor, patch] = parts;
  
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return currentVersion;
  }
}

function extractContent(fullContent: string): string {
  const lines = fullContent.split('\n');
  let endIndex = -1;
  let foundFirst = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (!foundFirst) {
        foundFirst = true;
      } else {
        endIndex = i;
        break;
      }
    }
  }
  
  if (endIndex === -1) {
    return fullContent;
  }
  
  return lines.slice(endIndex + 1).join('\n');
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
  .argument('<prompt>', 'Prompt to edit (format: name, namespace/name, name@version, namespace/name@version)')
  .option('--dry-run', 'Edit prompt locally without pushing to git')
  .action(async (promptArg, { dryRun }) => {
    const configPath = join(homedir(), '.config', 'promptdock', 'config.json');
    
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const repoPath = config.local;
      
      // Parse prompt specification
      const spec = parsePromptSpec(promptArg);
      const allPrompts = findPrompts(repoPath);
      
      // Find matching prompts
      let matchingPrompts = allPrompts.filter(p => {
        const nameMatch = p.name === spec.name;
        const namespaceMatch = !spec.namespace || p.namespace === spec.namespace;
        const versionMatch = !spec.version || p.version === spec.version;
        return nameMatch && namespaceMatch && versionMatch;
      });
      
      if (matchingPrompts.length === 0) {
        console.error(`❌ No prompt found: ${promptArg}`);
        return;
      }
      
      let targetPrompt: PromptInfo;
      
      if (matchingPrompts.length === 1) {
        targetPrompt = matchingPrompts[0];
      } else if (spec.version === 'latest') {
        targetPrompt = getLatestVersion(matchingPrompts);
      } else if (!spec.version) {
        // Multiple versions found, ask user to choose
        console.log(`📝 Multiple versions found for ${spec.namespace ? spec.namespace + '/' : ''}${spec.name}:`);
        for (let i = 0; i < matchingPrompts.length; i++) {
          const prompt = matchingPrompts[i];
          console.log(`  ${i + 1}. v${prompt.version} (${prompt.description})`);
        }
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const choice = await new Promise<string>((resolve) => {
          rl.question('Select version to edit (number): ', resolve);
        });
        rl.close();
        
        const index = parseInt(choice) - 1;
        if (index < 0 || index >= matchingPrompts.length) {
          console.error('❌ Invalid selection');
          return;
        }
        
        targetPrompt = matchingPrompts[index];
      } else {
        console.error(`❌ Multiple matches found. Please be more specific.`);
        return;
      }
      
      if (!targetPrompt) {
        console.error(`❌ Prompt not found: ${promptArg}`);
        return;
      }
      
      console.log(`📝 Editing prompt: ${targetPrompt.namespace}/${targetPrompt.name} (v${targetPrompt.version})`);
      
      // Read current content and extract just the content part (without header)
      const fullContent = readFileSync(targetPrompt.file, 'utf-8');
      const contentOnly = extractContent(fullContent);
      
      // Write content-only version for editing
      writeFileSync(targetPrompt.file, contentOnly);
      
      // Open editor
      const editor = process.env.EDITOR || 'nano';
      const child = spawn(editor, [targetPrompt.file], { 
        stdio: 'inherit' 
      });
      
      child.on('close', async (code) => {
        if (code !== 0) {
          console.log('❌ Editor exited with error');
          // Restore original content
          writeFileSync(targetPrompt.file, fullContent);
          return;
        }
        
        // Ask for version bump
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        let bumpType: string;
        do {
          bumpType = await new Promise<string>((resolve) => {
            rl.question(`📈 How to bump version ${targetPrompt.version}? (major/minor/patch): `, resolve);
          });
          
          if (!['major', 'minor', 'patch'].includes(bumpType.toLowerCase())) {
            console.log('❌ Please choose one of: major, minor, patch');
          }
        } while (!['major', 'minor', 'patch'].includes(bumpType.toLowerCase()));
        
        const newVersion = bumpVersion(targetPrompt.version, bumpType.toLowerCase() as 'major' | 'minor' | 'patch');
        
        // Read edited content
        const editedContent = readFileSync(targetPrompt.file, 'utf-8');
        
        // Create new versioned file
        const sanitizedName = targetPrompt.name;
        const newFileName = `${sanitizedName}-${newVersion}.md`;
        const newFilePath = join(dirname(targetPrompt.file), newFileName);
        
        // Create new header with updated version
        const tagsStr = targetPrompt.tags.length > 0 ? `\ntags: [${targetPrompt.tags.map(tag => `"${tag}"`).join(', ')}]` : '';
        const newHeader = `---
name: ${targetPrompt.name}
namespace: ${targetPrompt.namespace}
version: ${newVersion}
author: ${targetPrompt.author}
description: ${targetPrompt.description}
created: ${targetPrompt.created}${tagsStr}
---

`;
        
        // Combine header with edited content
        const finalContent = newHeader + editedContent;
        writeFileSync(newFilePath, finalContent);
        
        // Restore original file (in case user cancels git operations)
        writeFileSync(targetPrompt.file, fullContent);
        
        // Validate header
        if (!validateHeader(finalContent)) {
          console.error('❌ Invalid header format. Please fix and try again.');
          return;
        }
        
        console.log(`✅ Prompt updated to version ${newVersion}!`);
        
        if (dryRun) {
          console.log('🔍 Dry run: Prompt edited locally without pushing to git');
          return;
        }
        
        // Ask if user wants to commit and push
        const answer = await new Promise<string>((resolve) => {
          rl.question('🚀 Do you want to commit and push this edit? (y/N): ', resolve);
        });
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          rl.close();
          const git = simpleGit(repoPath);
          const relativeFile = join(targetPrompt.namespace, newFileName);
          
          await git.add(relativeFile);
          await git.commit(`Update prompt: ${targetPrompt.namespace}/${targetPrompt.name} to v${newVersion}`);
          await git.push('origin', 'main');
          
          console.log(`✅ New version v${newVersion} committed and pushed successfully!`);
          console.log(`📄 Created: ${targetPrompt.namespace}/${newFileName}`);
        } else {
          console.log('📝 New version created locally only');
          
          // Ask if they want to delete the new version locally
          const deleteAnswer = await new Promise<string>((resolve) => {
            rl.question('🗑️  Do you want to delete the new version locally? (y/N): ', resolve);
          });
          rl.close();
          
          if (deleteAnswer.toLowerCase() === 'y' || deleteAnswer.toLowerCase() === 'yes') {
            const fs = await import('fs');
            fs.unlinkSync(newFilePath);
            console.log('🗑️  New version deleted locally.');
          } else {
            console.log(`📄 New version saved as: ${targetPrompt.namespace}/${newFileName}`);
          }
        }
      });
      
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        console.error('❌ No configuration found. Run "promptdock init" first.');
      } else {
        console.error('❌ Failed to edit prompt:', error instanceof Error ? error.message : String(error));
      }
    }
  });

export default cmd;