import { Command } from 'commander';
import { input, confirm, password } from '@inquirer/prompts';
import { readProjectConfig } from '../lib/config.js';
import { NotionPlugin, NotionConfig } from '../lib/notion-plugin.js';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const cmd = new Command('notion');

// Load or create Notion config
function getNotionConfigPath(): string {
  return join(process.cwd(), '.notion-config.json');
}

function loadNotionConfig(): NotionConfig | null {
  const configPath = getNotionConfigPath();
  if (!existsSync(configPath)) return null;
  
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveNotionConfig(config: NotionConfig): void {
  const configPath = getNotionConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

// Setup Notion integration
async function setupNotion(): Promise<NotionConfig> {
  console.log('🔧 Setting up Notion integration...\n');
  console.log('To get started:');
  console.log('1. Go to https://www.notion.so/my-integrations');
  console.log('2. Create a new integration');
  console.log('3. Copy the "Internal Integration Token"');
  console.log('4. Create a database in Notion');
  console.log('5. Share the database with your integration');
  console.log('6. Copy the database ID from the URL\n');

  const token = await password({
    message: 'Notion Integration Token:',
    mask: '*'
  });

  const databaseId = await input({
    message: 'Notion Database ID:',
    validate: (input) => input.trim().length > 0 || 'Database ID is required'
  });

  const config: NotionConfig = {
    token: token.trim(),
    databaseId: databaseId.trim(),
    syncEnabled: true
  };

  // Test the connection
  console.log('🔍 Testing connection...');
  const plugin = new NotionPlugin(config);
  const connected = await plugin.testConnection();

  if (!connected) {
    throw new Error('Failed to connect to Notion. Please check your token and database ID.');
  }

  console.log('✅ Connected to Notion successfully!');

  // Setup database properties
  console.log('🔧 Setting up database properties...');
  await plugin.setupDatabase();

  // Save config
  saveNotionConfig(config);
  console.log('✅ Notion configuration saved to .notion-config.json');

  return config;
}

// Sync prompts to Notion
async function syncToNotion(config: NotionConfig): Promise<void> {
  const projectConfig = readProjectConfig();
  if (!projectConfig) {
    throw new Error('No prompt.json found. Run "prompt init" first.');
  }

  const plugin = new NotionPlugin(config);
  
  console.log('📂 Scanning for prompts...');
  const prompts = await plugin.scanPrompts(process.cwd());
  
  if (prompts.length === 0) {
    console.log('📭 No prompts found to sync.');
    return;
  }

  console.log(`📋 Found ${prompts.length} prompts:`);
  for (const prompt of prompts) {
    console.log(`   • ${prompt.namespace}/${prompt.folder}/${prompt.name}`);
  }

  const proceed = await confirm({
    message: `\nSync ${prompts.length} prompts to Notion?`,
    default: true
  });

  if (!proceed) {
    console.log('❌ Sync cancelled.');
    return;
  }

  await plugin.syncPrompts(prompts);
}

// Test Notion connection
async function testNotion(config: NotionConfig): Promise<void> {
  console.log('🔍 Testing Notion connection...');
  
  const plugin = new NotionPlugin(config);
  const connected = await plugin.testConnection();

  if (connected) {
    console.log('✅ Notion connection successful!');
    
    // Test scanning
    console.log('📂 Testing prompt scanning...');
    const prompts = await plugin.scanPrompts(process.cwd());
    console.log(`📋 Found ${prompts.length} prompts to sync`);
  } else {
    console.log('❌ Failed to connect to Notion. Please check your configuration.');
  }
}

cmd
  .command('setup')
  .description('Setup Notion integration')
  .action(async () => {
    try {
      await setupNotion();
    } catch (error) {
      console.error('❌ Setup failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

cmd
  .command('sync')
  .description('Sync prompts to Notion database')
  .action(async () => {
    try {
      const config = loadNotionConfig();
      if (!config) {
        console.error('❌ Notion not configured. Run "prompt notion setup" first.');
        return;
      }

      await syncToNotion(config);
    } catch (error) {
      console.error('❌ Sync failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

cmd
  .command('test')
  .description('Test Notion connection')
  .action(async () => {
    try {
      const config = loadNotionConfig();
      if (!config) {
        console.error('❌ Notion not configured. Run "prompt notion setup" first.');
        return;
      }

      await testNotion(config);
    } catch (error) {
      console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

cmd
  .command('status')
  .description('Show Notion integration status')
  .action(async () => {
    const config = loadNotionConfig();
    
    if (!config) {
      console.log('❌ Notion integration not configured');
      console.log('   Run "prompt notion setup" to get started');
      return;
    }

    console.log('✅ Notion integration configured');
    console.log(`   Database ID: ${config.databaseId}`);
    console.log(`   Sync enabled: ${config.syncEnabled ? 'Yes' : 'No'}`);
    
    // Test connection
    const plugin = new NotionPlugin(config);
    const connected = await plugin.testConnection();
    console.log(`   Connection: ${connected ? '✅ Working' : '❌ Failed'}`);
  });

export default cmd;