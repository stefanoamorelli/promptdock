import { Command } from 'commander';
import simpleGit from 'simple-git';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import readline from 'readline';

const cmd = new Command('sync');

cmd
  .description('Pull latest changes from the prompt repository')
  .action(async () => {
    const configPath = join(homedir(), '.config', 'promptdock', 'config.json');
    
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const repoPath = config.local;
      
      console.log(`🔄 Syncing ${repoPath}...`);
      
      const git = simpleGit(repoPath);
      
      // Check if repo has any commits
      try {
        await git.log(['-1']);
        
        // Check for uncommitted changes
        const status = await git.status();
        const hasChanges = status.files.length > 0;
        
        if (hasChanges) {
          console.log('⚠️  You have uncommitted changes:');
          for (const file of status.files) {
            console.log(`  ${file.working_dir}${file.index} ${file.path}`);
          }
          
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const answer = await new Promise<string>((resolve) => {
            rl.question('🔄 Do you want to do a hard sync? This will discard local changes. (y/N): ', resolve);
          });
          rl.close();
          
          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('❌ Sync cancelled. Use "status --clean" to manage uncommitted changes.');
            return;
          }
          
          // Hard reset to match remote
          console.log('🔄 Performing hard sync...');
          await git.fetch();
          await git.reset(['--hard', `origin/${status.current}`]);
          console.log('✅ Hard sync completed! Local repo now matches remote.');
        } else {
          // No local changes, safe to pull
          const currentBranch = status.current || 'main';
          await git.fetch();
          await git.pull('origin', currentBranch);
          console.log('✅ Repository synced successfully!');
        }
      } catch (logError) {
        // Empty repo - just fetch to see if anything was added
        await git.fetch();
        console.log('ℹ️  Repository is empty, nothing to sync.');
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        console.error('❌ No configuration found. Run "promptdock init" first.');
      } else {
        console.error('❌ Sync failed:', error instanceof Error ? error.message : String(error));
      }
    }
  });

export default cmd;