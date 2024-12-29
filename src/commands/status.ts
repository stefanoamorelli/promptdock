import { Command } from 'commander';
import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import simpleGit from 'simple-git';
import readline from 'readline';

const cmd = new Command('status');

interface UncommittedPrompt {
  file: string;
  namespace: string;
  name: string;
  version: string;
  author: string;
  description: string;
  tags: string[];
}

function parsePromptFile(filePath: string): UncommittedPrompt | null {
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
          // Parse tags array: ["tag1", "tag2", "tag3"]
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
    
    // Extract namespace from file path
    const pathParts = filePath.split('/');
    const namespace = pathParts[pathParts.length - 2];
    
    return {
      file: filePath,
      namespace,
      name: metadata.name || 'Unknown',
      version: metadata.version || 'Unknown',
      author: metadata.author || 'Unknown',
      description: metadata.description || 'No description',
      tags: metadata.tags || []
    };
  } catch (error) {
    return null;
  }
}

function formatUncommittedTable(prompts: UncommittedPrompt[]): void {
  if (prompts.length === 0) {
    console.log('✅ No uncommitted prompts found.');
    return;
  }
  
  // Calculate column widths
  const widths = {
    namespace: Math.max(9, ...prompts.map(p => p.namespace.length)),
    name: Math.max(4, ...prompts.map(p => p.name.length)),
    version: Math.max(7, ...prompts.map(p => p.version.length)),
    author: Math.max(6, ...prompts.map(p => p.author.length)),
    tags: Math.max(4, ...prompts.map(p => p.tags.join(', ').length)),
    description: Math.max(11, ...prompts.map(p => Math.min(p.description.length, 35)))
  };
  
  // Helper function to pad strings
  const pad = (str: string, width: number) => str.padEnd(width);
  
  console.log('🔄 Uncommitted prompts:');
  console.log();
  
  // Print header
  console.log(
    pad('NAMESPACE', widths.namespace) + ' | ' +
    pad('NAME', widths.name) + ' | ' +
    pad('VERSION', widths.version) + ' | ' +
    pad('AUTHOR', widths.author) + ' | ' +
    pad('TAGS', widths.tags) + ' | ' +
    pad('DESCRIPTION', widths.description)
  );
  
  // Print separator
  console.log(
    '-'.repeat(widths.namespace) + '-+-' +
    '-'.repeat(widths.name) + '-+-' +
    '-'.repeat(widths.version) + '-+-' +
    '-'.repeat(widths.author) + '-+-' +
    '-'.repeat(widths.tags) + '-+-' +
    '-'.repeat(widths.description)
  );
  
  // Print rows
  for (const prompt of prompts) {
    const truncatedDesc = prompt.description.length > 35 
      ? prompt.description.substring(0, 32) + '...' 
      : prompt.description;
    const tagsStr = prompt.tags.join(', ');
    
    console.log(
      pad(prompt.namespace, widths.namespace) + ' | ' +
      pad(prompt.name, widths.name) + ' | ' +
      pad(prompt.version, widths.version) + ' | ' +
      pad(prompt.author, widths.author) + ' | ' +
      pad(tagsStr, widths.tags) + ' | ' +
      pad(truncatedDesc, widths.description)
    );
  }
  
  console.log(`\n📊 Total: ${prompts.length} uncommitted prompts`);
}

cmd
  .option('--clean', 'Delete all uncommitted prompts')
  .action(async ({ clean }) => {
    const configPath = join(homedir(), '.config', 'promptdock', 'config.json');
    
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const repoPath = config.local;
      
      const git = simpleGit(repoPath);
      
      // Get uncommitted files
      const status = await git.status();
      const uncommittedFiles = [
        ...status.not_added,
        ...status.created,
        ...status.modified
      ].filter(file => file.endsWith('.md'));
      
      if (uncommittedFiles.length === 0) {
        console.log('✅ No uncommitted prompts found.');
        return;
      }
      
      // Parse uncommitted prompts
      const uncommittedPrompts: UncommittedPrompt[] = [];
      for (const file of uncommittedFiles) {
        const fullPath = join(repoPath, file);
        const prompt = parsePromptFile(fullPath);
        if (prompt) {
          uncommittedPrompts.push(prompt);
        }
      }
      
      formatUncommittedTable(uncommittedPrompts);
      
      if (clean) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>((resolve) => {
          rl.question(`⚠️  Are you sure you want to delete all ${uncommittedPrompts.length} uncommitted prompts? (y/N): `, resolve);
        });
        rl.close();
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          for (const prompt of uncommittedPrompts) {
            unlinkSync(prompt.file);
            console.log(`🗑️  Deleted: ${prompt.namespace}/${prompt.name}`);
          }
          console.log('✅ All uncommitted prompts deleted.');
        } else {
          console.log('❌ Cancelled.');
        }
      }
      
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        console.error('❌ No configuration found. Run "promptdock init" first.');
      } else {
        console.error('❌ Failed to check status:', error instanceof Error ? error.message : String(error));
      }
    }
  });

export default cmd;