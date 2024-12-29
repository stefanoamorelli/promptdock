import { Command } from 'commander';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const cmd = new Command('list');

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

function parseVersion(version: string): { major: number, minor: number, patch: number } {
  const parts = version.split('.').map(n => parseInt(n) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

function formatTable(prompts: PromptInfo[]): void {
  if (prompts.length === 0) {
    console.log('📭 No prompts found.');
    return;
  }
  
  // Calculate column widths
  const widths = {
    namespace: Math.max(9, ...prompts.map(p => p.namespace.length)),
    name: Math.max(4, ...prompts.map(p => p.name.length)),
    version: Math.max(7, ...prompts.map(p => p.version.length)),
    author: Math.max(6, ...prompts.map(p => p.author.length)),
    tags: Math.max(4, ...prompts.map(p => p.tags.join(', ').length)),
    description: Math.max(11, ...prompts.map(p => Math.min(p.description.length, 40)))
  };
  
  // Helper function to pad strings
  const pad = (str: string, width: number) => str.padEnd(width);
  
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
    const truncatedDesc = prompt.description.length > 40 
      ? prompt.description.substring(0, 37) + '...' 
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
  
  console.log(`\n📊 Total: ${prompts.length} prompts`);
}

cmd
  .option('--namespace <namespace>', 'Filter by namespace')
  .option('--tag <tag>', 'Filter by tag')
  .option('--latest-only', 'Show only latest version of each prompt')
  .option('--name <name>', 'Filter by prompt name')
  .action(async ({ namespace, tag, latestOnly, name }) => {
    const configPath = join(homedir(), '.config', 'promptdock', 'config.json');
    
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const repoPath = config.local;
      
      let prompts = findPrompts(repoPath);
      
      // Filter by namespace if specified
      if (namespace) {
        prompts = prompts.filter(p => p.namespace === namespace);
      }
      
      // Filter by tag if specified
      if (tag) {
        prompts = prompts.filter(p => p.tags.includes(tag));
      }
      
      // Filter by name if specified
      if (name) {
        prompts = prompts.filter(p => p.name === name);
      }
      
      // Show only latest versions if specified
      if (latestOnly) {
        const promptGroups = new Map<string, PromptInfo[]>();
        
        // Group by namespace/name
        for (const prompt of prompts) {
          const key = `${prompt.namespace}/${prompt.name}`;
          if (!promptGroups.has(key)) {
            promptGroups.set(key, []);
          }
          promptGroups.get(key)!.push(prompt);
        }
        
        // Get latest version from each group
        prompts = Array.from(promptGroups.values()).map(group => {
          return group.sort((a, b) => {
            const aVersion = parseVersion(a.version);
            const bVersion = parseVersion(b.version);
            
            if (aVersion.major !== bVersion.major) return bVersion.major - aVersion.major;
            if (aVersion.minor !== bVersion.minor) return bVersion.minor - aVersion.minor;
            return bVersion.patch - aVersion.patch;
          })[0];
        });
      }
      
      // Sort by namespace, then by name, then by version (desc)
      prompts.sort((a, b) => {
        if (a.namespace !== b.namespace) {
          return a.namespace.localeCompare(b.namespace);
        }
        if (a.name !== b.name) {
          return a.name.localeCompare(b.name);
        }
        
        // Sort versions in descending order (latest first)
        const aVersion = parseVersion(a.version);
        const bVersion = parseVersion(b.version);
        
        if (aVersion.major !== bVersion.major) return bVersion.major - aVersion.major;
        if (aVersion.minor !== bVersion.minor) return bVersion.minor - aVersion.minor;
        return bVersion.patch - aVersion.patch;
      });
      
      formatTable(prompts);
      
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        console.error('❌ No configuration found. Run "promptdock init" first.');
      } else {
        console.error('❌ Failed to list prompts:', error instanceof Error ? error.message : String(error));
      }
    }
  });

export default cmd;