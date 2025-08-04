import { Command } from 'commander';
import simpleGit from 'simple-git';
import { writeConfig } from '../lib/config.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { input, select, confirm, checkbox } from '@inquirer/prompts';
import { ProviderHandler } from '../lib/providers.js';
import { PromptConfig as ImportedPromptConfig, ProjectConfig as ImportedProjectConfig, Provider, ProviderConfig } from '../lib/config.js';

const cmd = new Command('init');

// Use the imported types
type PromptConfig = ImportedPromptConfig;
type ProjectConfig = ImportedProjectConfig;

// Interactive project setup mode
async function projectSetup(): Promise<void> {
  console.log('🚀 Welcome to PromptDock project setup!');
  console.log('This will create a prompt.json file to configure automatic prompt downloads in this folder.\n');

  const projectName = await input({
    message: 'Project name:',
    default: process.cwd().split('/').pop() || 'my-project'
  });

  const projectDescription = await input({
    message: 'Project description:',
    default: 'AI prompts for ' + projectName
  });

  // Configure AI providers
  console.log('\n🤖 Configure AI Providers:');
  const providerChoices = [
    { name: 'Claude (with commands)', value: 'claude', checked: true },
    { name: 'Cursor', value: 'cursor', checked: true },
    { name: 'GitHub Copilot', value: 'copilot', checked: false },
    { name: 'Gemini CLI', value: 'gemini', checked: false },
    { name: 'Codeium', value: 'codeium', checked: false },
    { name: 'Continue', value: 'continue', checked: false },
    { name: 'Aider', value: 'aider', checked: false }
  ];

  const selectedProviders = await checkbox({
    message: 'Select AI providers to generate configs for:',
    choices: providerChoices
  }) as Provider[];

  // Get provider-specific settings
  const providers = ProviderHandler.getDefaultProviderConfig();
  
  // Only keep selected providers
  for (const provider of Object.keys(providers) as Provider[]) {
    if (!selectedProviders.includes(provider)) {
      delete (providers as any)[provider];
    }
  }

  // Ask about Claude commands if Claude is selected
  if (selectedProviders.includes('claude')) {
    providers.claude.includeCommands = await confirm({
      message: 'Include Claude command documentation?',
      default: true
    });
  }

  // Ask which folders to add to .gitignore
  const ignoreOptions = [
    { name: '.promptdock/', value: '.promptdock/', checked: true }
  ];

  // Add provider folders to gitignore options
  for (const [provider, config] of Object.entries(providers)) {
    if ('folder' in config) {
      ignoreOptions.push({
        name: config.folder,
        value: config.folder,
        checked: true
      });
    }
  }

  const gitignoreEntries = await checkbox({
    message: 'Select folders to add to .gitignore:',
    choices: ignoreOptions
  });

  // Ask about prompts to auto-download
  const addPrompts = await confirm({
    message: 'Do you want to configure prompts to auto-download?',
    default: true
  });

  const prompts: PromptConfig[] = [];
  
  if (addPrompts) {
    let addMore = true;
    while (addMore) {
      console.log('\n📝 Adding a prompt configuration:');
      
      const promptName = await input({
        message: 'Prompt name (used for folder naming):'
      });

      const promptDescription = await input({
        message: 'Prompt description:'
      });

      const repo = await input({
        message: 'Global repository URL:',
        default: 'https://github.com/user/prompts.git'
      });

      const namespace = await input({
        message: 'Namespace/path within repo (e.g., web, backend, mobile):',
        validate: (input) => input.trim().length > 0 || 'Namespace is required'
      });

      const foldersInput = await input({
        message: 'Folders to create (comma-separated):',
        default: 'system,user,assistant'
      });

      const folders = foldersInput.split(',').map(f => f.trim()).filter(f => f.length > 0);

      // Configure providers for this prompt
      const promptProviders: Record<Provider, ProviderConfig> = {} as any;
      
      for (const provider of selectedProviders) {
        promptProviders[provider] = {
          enabled: true,
          includeCommands: provider === 'claude' ? providers.claude?.includeCommands : undefined
        };
      }

      prompts.push({
        name: promptName,
        description: promptDescription,
        repo,
        namespace,
        folders,
        providers: promptProviders
      });

      addMore = await confirm({
        message: 'Add another prompt configuration?',
        default: false
      });
    }
  }

  // Create project config
  const config: ProjectConfig = {
    name: projectName,
    description: projectDescription,
    prompts,
    gitignore: gitignoreEntries,
    providers
  };

  // Write prompt.json
  const promptJsonPath = join(process.cwd(), 'prompt.json');
  writeFileSync(promptJsonPath, JSON.stringify(config, null, 2));
  console.log(`✅ Created prompt.json`);

  // Update .gitignore
  const gitignorePath = join(process.cwd(), '.gitignore');
  let gitignoreContent = '';
  
  if (existsSync(gitignorePath)) {
    gitignoreContent = readFileSync(gitignorePath, 'utf-8');
  }

  const newEntries = gitignoreEntries.filter(entry => 
    !gitignoreContent.includes(entry)
  );

  if (newEntries.length > 0) {
    if (gitignoreContent && !gitignoreContent.endsWith('\n')) {
      gitignoreContent += '\n';
    }
    gitignoreContent += '\n# PromptDock\n' + newEntries.join('\n') + '\n';
    writeFileSync(gitignorePath, gitignoreContent);
    console.log(`✅ Updated .gitignore with ${newEntries.length} entries`);
  }

  // Create initial folder structure
  if (prompts.length > 0) {
    console.log('\n📁 Creating folder structure...');
    for (const prompt of prompts) {
      const promptDir = join(process.cwd(), prompt.name);
      mkdirSync(promptDir, { recursive: true });
      
      for (const folder of prompt.folders) {
        const folderPath = join(promptDir, folder);
        mkdirSync(folderPath, { recursive: true });
        
        // Create documentation.md template
        const docPath = join(folderPath, 'documentation.md');
        if (!existsSync(docPath)) {
          const docContent = `# ${folder} Prompts

## Purpose
Description of what prompts in this folder are for.

## Usage
How to use these prompts.

## Examples
Example use cases or scenarios.
`;
          writeFileSync(docPath, docContent);
        }
      }
      console.log(`   ✅ Created ${prompt.name}/ with folders: ${prompt.folders.join(', ')}`);
    }
  }

  // Create provider folders
  console.log('\n📁 Creating provider folders...');
  for (const [provider, config] of Object.entries(providers)) {
    if ('folder' in config) {
      const folderPath = join(process.cwd(), config.folder);
      mkdirSync(folderPath, { recursive: true });
      console.log(`   ✅ Created ${config.folder}/ for ${provider}`);
    }
  }

  console.log('\n🎉 Project setup complete!');
  console.log('\nNext steps:');
  console.log('  • Run "prompt pull" to download configured prompts');
  console.log('  • Add your prompts to the created folders');
  console.log('  • Use "prompt sync" to sync with remote sources');
}

// Global PromptDock setup mode  
async function globalSetup(origin?: string, dir?: string): Promise<void> {
  const baseDir = dir || join(homedir(), '.config', 'promptdock');
  const repoPath = join(baseDir, 'prompts');
  
  if (existsSync(repoPath)) {
    const replace = await confirm({
      message: `${repoPath} already exists. Do you want to replace it?`,
      default: false
    });
    
    if (!replace) {
      console.log('❌ Cancelled.');
      return;
    }
    
    console.log('🗑️  Removing existing repository...');
    await import('fs').then(fs => fs.rmSync(repoPath, { recursive: true, force: true }));
  }

  let repoUrl = origin;
  if (!repoUrl) {
    repoUrl = await input({
      message: 'Prompt repository URL:',
      validate: (input) => input.trim().length > 0 || 'Repository URL is required'
    });
  }

  console.log(`📥 Cloning repository...`);
  const git = simpleGit();
  await git.clone(repoUrl, repoPath);
  writeConfig({ origin: repoUrl, local: repoPath });

  console.log(`✅ Cloned ${repoUrl} → ${repoPath}`);
  console.log(`ℹ️  Ready to use "prompt new" etc.`);
}

cmd
  .option('--origin <git-url>', 'Prompt repo URL (for global setup)')
  .option('--dir <path>', 'Local promptdock directory (for global setup)')
  .option('--global', 'Setup global PromptDock configuration')
  .action(async ({ origin, dir, global: isGlobal }) => {
    try {
      if (isGlobal || origin) {
        // Global setup mode
        await globalSetup(origin, dir);
      } else {
        // Project setup mode (default)
        await projectSetup();
      }
    } catch (error) {
      console.error('❌ Setup failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export default cmd;
