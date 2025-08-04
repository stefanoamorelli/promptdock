import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { readProjectConfig, readConfig, Provider } from '../lib/config.js';
import simpleGit from 'simple-git';
import { execa } from 'execa';
import { ProviderHandler } from '../lib/providers.js';

const cmd = new Command('pull');

interface PromptFile {
  path: string;
  content: string;
  folder: string;
  name: string;
}

async function downloadFromGit(repo: string, namespace: string, targetDir: string): Promise<PromptFile[]> {
  const tempDir = join(targetDir, '.temp_' + Date.now());
  
  try {
    console.log(`📥 Cloning from ${repo}...`);
    const git = simpleGit();
    await git.clone(repo, tempDir);
    
    // Look for files in the specific namespace path
    const namespacePath = join(tempDir, namespace);
    if (!existsSync(namespacePath)) {
      console.warn(`⚠️  Namespace '${namespace}' not found in repository`);
      return [];
    }
    
    const files = await findPromptFiles(namespacePath);
    
    // Clean up temp directory
    await import('fs').then(fs => fs.rmSync(tempDir, { recursive: true, force: true }));
    
    return files;
  } catch (error) {
    // Clean up on error
    if (existsSync(tempDir)) {
      await import('fs').then(fs => fs.rmSync(tempDir, { recursive: true, force: true }));
    }
    throw error;
  }
}


async function findPromptFiles(dir: string): Promise<PromptFile[]> {
  const files: PromptFile[] = [];
  const { stdout } = await execa('find', [dir, '-name', '*.md', '-o', '-name', '*.txt']);
  
  for (const filePath of stdout.split('\n').filter(p => p.trim())) {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      const relativePath = filePath.replace(dir, '').replace(/^\//, '');
      const parts = relativePath.split('/');
      const folder = parts.length > 1 ? parts[parts.length - 2] : 'general';
      const name = parts[parts.length - 1].replace(/\.(md|txt)$/, '');
      
      files.push({
        path: relativePath,
        content,
        folder,
        name
      });
    }
  }
  
  return files;
}

function organizePromptsByFolder(files: PromptFile[], configuredFolders: string[]): Record<string, PromptFile[]> {
  const organized: Record<string, PromptFile[]> = {};
  
  // Initialize configured folders
  for (const folder of configuredFolders) {
    organized[folder] = [];
  }
  
  // Organize files
  for (const file of files) {
    const targetFolder = configuredFolders.includes(file.folder) ? file.folder : 'general';
    if (!organized[targetFolder]) {
      organized[targetFolder] = [];
    }
    organized[targetFolder].push(file);
  }
  
  return organized;
}

async function savePromptsToFolders(
  organizedPrompts: Record<string, PromptFile[]>, 
  promptName: string, 
  baseDir: string
): Promise<void> {
  const promptDir = join(baseDir, promptName);
  
  for (const [folder, files] of Object.entries(organizedPrompts)) {
    if (files.length === 0) continue;
    
    const folderPath = join(promptDir, folder);
    mkdirSync(folderPath, { recursive: true });
    
    for (const file of files) {
      const outputPath = join(folderPath, `${file.name}.md`);
      writeFileSync(outputPath, file.content);
      console.log(`   ✅ ${folder}/${file.name}.md`);
    }
  }
}

cmd
  .option('--all', 'Pull all configured prompts')
  .option('--prompt <name>', 'Pull specific prompt by name')
  .action(async ({ all, prompt }) => {
    try {
      // Read project configuration
      const projectConfig = readProjectConfig();
      if (!projectConfig) {
        console.error('❌ No prompt.json found. Run "prompt init" first.');
        return;
      }
      
      if (!all && !prompt) {
        console.error('❌ Please specify --all to pull all prompts or --prompt <name> for a specific prompt.');
        console.log('\nAvailable prompts:');
        for (const p of projectConfig.prompts) {
          console.log(`  • ${p.name}: ${p.description}`);
        }
        return;
      }
      
      const promptsToPull = all ? projectConfig.prompts : 
        projectConfig.prompts.filter(p => p.name === prompt);
      
      if (promptsToPull.length === 0) {
        console.error(`❌ Prompt "${prompt}" not found in configuration.`);
        return;
      }
      
      console.log(`🚀 Pulling ${promptsToPull.length} prompt(s)...\n`);
      
      // Initialize provider handler
      const providerHandler = new ProviderHandler(projectConfig, process.cwd());
      
      for (const promptConfig of promptsToPull) {
        console.log(`📦 Processing ${promptConfig.name}...`);
        
        let files: PromptFile[] = [];
        
        // Download from the configured repository and namespace
        files = await downloadFromGit(promptConfig.repo, promptConfig.namespace, process.cwd());
        
        if (files.length === 0) {
          console.log(`   ⚠️  No prompt files found in ${promptConfig.repo}/${promptConfig.namespace}`);
          continue;
        }
        
        // Organize files by configured folders
        const organizedPrompts = organizePromptsByFolder(files, promptConfig.folders);
        
        // Save to folder structure
        await savePromptsToFolders(organizedPrompts, promptConfig.name, process.cwd());
        
        // Generate provider-specific files
        if (promptConfig.providers) {
          console.log(`   📝 Generating provider configs...`);
          const allPromptContent: string[] = [];
          
          // Collect all prompt content
          for (const prompts of Object.values(organizedPrompts)) {
            for (const prompt of prompts) {
              allPromptContent.push(prompt.content);
            }
          }
          
          // Generate and write provider files
          const providerFiles = await providerHandler.generateProviderFiles(allPromptContent, promptConfig.name);
          await providerHandler.writeProviderFiles(providerFiles);
        }
        
        console.log(`   ✅ ${promptConfig.name} pulled successfully (${files.length} files)\n`);
      }
      
      console.log('🎉 All prompts pulled successfully!');
      
    } catch (error) {
      console.error('❌ Pull failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export default cmd;