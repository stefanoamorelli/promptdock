import { Command } from 'commander';
import simpleGit from 'simple-git';
import { writeConfig } from '../lib/config.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import readline from 'readline';

const cmd = new Command('init');

cmd
  .requiredOption('--origin <git-url>', 'Prompt repo URL')
  .option('--dir <path>', 'Local promptdock directory')
  .action(async ({ origin, dir }) => {
    const baseDir = dir || join(homedir(), '.config', 'promptdock');
    const repoPath = join(baseDir, 'prompts');
    
    if (existsSync(repoPath)) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>((resolve) => {
        rl.question(`❓ ${repoPath} already exists. Do you want to replace it? (y/N): `, resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ Cancelled.');
        return;
      }
      
      console.log('🗑️  Removing existing repository...');
      await import('fs').then(fs => fs.rmSync(repoPath, { recursive: true, force: true }));
    }

    const git = simpleGit();
    await git.clone(origin, repoPath);
    writeConfig({ origin, local: repoPath });

    console.log(`✅ Cloned ${origin} → ${repoPath}`);
    console.log(`ℹ️  Ready to use "prompt new" etc.`);
  });

export default cmd;
