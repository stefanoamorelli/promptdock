import { Command } from 'commander';
import { readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import simpleGit from 'simple-git';
import readline from 'readline';

const cmd = new Command('delete');

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

function parseVersion(version: string): { major: number, minor: number, patch: number } {
  const parts = version.split('.').map(n => parseInt(n) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
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

cmd
  .argument('<prompt>', 'Prompt to delete (format: name, namespace/name, name@version, namespace/name@version)')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--all-versions', 'Delete all versions of the prompt')
  .action(async (promptArg, { dryRun, allVersions }) => {
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
      
      let targetPrompts: PromptInfo[];
      
      if (allVersions) {
        // Delete all versions
        targetPrompts = matchingPrompts;
        console.log(`🗑️  Target for deletion (all versions):`);
        for (const prompt of targetPrompts) {
          console.log(`   • ${prompt.namespace}/${prompt.name}@${prompt.version} - ${prompt.description}`);
        }
      } else if (matchingPrompts.length === 1) {
        targetPrompts = [matchingPrompts[0]];
      } else if (spec.version === 'latest') {
        targetPrompts = [getLatestVersion(matchingPrompts)];
      } else if (!spec.version) {
        // Multiple versions found, ask user to choose
        console.log(`📝 Multiple versions found for ${spec.namespace ? spec.namespace + '/' : ''}${spec.name}:`);
        for (let i = 0; i < matchingPrompts.length; i++) {
          const prompt = matchingPrompts[i];
          console.log(`  ${i + 1}. v${prompt.version} (${prompt.description})`);
        }
        console.log(`  ${matchingPrompts.length + 1}. All versions`);
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const choice = await new Promise<string>((resolve) => {
          rl.question('Select version to delete (number): ', resolve);
        });
        rl.close();
        
        const index = parseInt(choice) - 1;
        if (index === matchingPrompts.length) {
          // Delete all versions
          targetPrompts = matchingPrompts;
        } else if (index >= 0 && index < matchingPrompts.length) {
          targetPrompts = [matchingPrompts[index]];
        } else {
          console.error('❌ Invalid selection');
          return;
        }
      } else {
        targetPrompts = matchingPrompts;
      }
      
      if (targetPrompts.length === 0) {
        console.error(`❌ No prompts to delete`);
        return;
      }
      
      // Show what will be deleted (if not already shown for all versions)
      if (!allVersions) {
        if (targetPrompts.length === 1) {
          const prompt = targetPrompts[0];
          console.log('🗑️  Target for deletion:');
          console.log(`   Prompt: ${prompt.namespace}/${prompt.name}@${prompt.version}`);
          console.log(`   Author: ${prompt.author}`);
          console.log(`   Description: ${prompt.description}`);
          console.log(`   File: ${prompt.file}`);
        } else {
          console.log('🗑️  Targets for deletion:');
          for (const prompt of targetPrompts) {
            console.log(`   • ${prompt.namespace}/${prompt.name}@${prompt.version} - ${prompt.description}`);
          }
        }
      }
      
      if (dryRun) {
        console.log('🔍 Dry run: Nothing was actually deleted');
        return;
      }
      
      // Confirmation prompt
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const promptCount = targetPrompts.length;
      const promptWord = promptCount === 1 ? 'prompt' : 'prompts';
      
      const answer = await new Promise<string>((resolve) => {
        rl.question(`⚠️  Are you sure you want to delete ${promptCount === 1 ? 'this' : 'these'} ${promptCount} ${promptWord}? This cannot be undone! (y/N): `, resolve);
      });
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        rl.close();
        console.log('❌ Deletion cancelled.');
        return;
      }
      
      // Ask if they want to delete remotely too
      const remoteAnswer = await new Promise<string>((resolve) => {
        rl.question(`🌐 Do you want to delete ${promptCount === 1 ? 'it' : 'them'} from the remote repository too? (y/N): `, resolve);
      });
      rl.close();
      
      // Delete locally
      console.log(`🗑️  Deleting ${promptCount} local file${promptCount === 1 ? '' : 's'}...`);
      const deletedFiles: string[] = [];
      
      for (const prompt of targetPrompts) {
        unlinkSync(prompt.file);
        console.log(`✅ Deleted: ${prompt.namespace}/${prompt.name}@${prompt.version}`);
        
        // Track relative paths for git
        const fileName = basename(prompt.file);
        deletedFiles.push(join(prompt.namespace, fileName));
      }
      
      if (remoteAnswer.toLowerCase() === 'y' || remoteAnswer.toLowerCase() === 'yes') {
        // Delete remotely by committing the deletion
        console.log('🌐 Deleting from remote repository...');
        const git = simpleGit(repoPath);
        
        for (const relativeFile of deletedFiles) {
          await git.add(relativeFile); // This stages the deletion
        }
        
        const commitMessage = promptCount === 1 
          ? `Delete prompt: ${targetPrompts[0].namespace}/${targetPrompts[0].name}@${targetPrompts[0].version}`
          : `Delete ${promptCount} prompts: ${spec.namespace ? spec.namespace + '/' : ''}${spec.name}`;
          
        await git.commit(commitMessage);
        await git.push('origin', 'main');
        
        console.log(`✅ ${promptCount} ${promptWord} deleted from remote repository successfully!`);
      } else {
        console.log(`📝 ${promptCount} ${promptWord} deleted locally only. Use "status" to see uncommitted changes.`);
      }
      
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        console.error('❌ No configuration found. Run "promptdock init" first.');
      } else {
        console.error('❌ Failed to delete prompt:', error instanceof Error ? error.message : String(error));
      }
    }
  });

export default cmd;