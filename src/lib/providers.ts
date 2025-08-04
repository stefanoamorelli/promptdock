import { Provider, ProjectConfig } from './config.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ProviderFile {
  provider: Provider;
  path: string;
  content: string;
}

export class ProviderHandler {
  private config: ProjectConfig;
  private baseDir: string;

  constructor(config: ProjectConfig, baseDir: string) {
    this.config = config;
    this.baseDir = baseDir;
  }

  /**
   * Generate provider-specific files from prompts
   */
  async generateProviderFiles(promptContent: string[], promptName: string): Promise<ProviderFile[]> {
    const files: ProviderFile[] = [];

    // Claude
    if (this.config.providers.claude) {
      const claudeContent = this.generateClaudeContent(promptContent, this.config.providers.claude.includeCommands);
      files.push({
        provider: 'claude',
        path: join(this.baseDir, this.config.providers.claude.folder, 'instructions.md'),
        content: claudeContent
      });

      if (this.config.providers.claude.includeCommands) {
        files.push({
          provider: 'claude',
          path: join(this.baseDir, this.config.providers.claude.folder, 'commands.md'),
          content: this.generateClaudeCommands()
        });
      }
    }

    // Cursor
    if (this.config.providers.cursor) {
      const cursorContent = this.generateCursorContent(promptContent);
      files.push({
        provider: 'cursor',
        path: join(this.baseDir, this.config.providers.cursor.folder, this.config.providers.cursor.filename),
        content: cursorContent
      });
    }

    // GitHub Copilot
    if (this.config.providers.copilot) {
      const copilotContent = this.generateCopilotContent(promptContent);
      files.push({
        provider: 'copilot',
        path: join(this.baseDir, this.config.providers.copilot.folder, this.config.providers.copilot.filename),
        content: copilotContent
      });
    }

    // Codeium
    if (this.config.providers.codeium) {
      const codeiumContent = this.generateCodeiumContent(promptContent);
      files.push({
        provider: 'codeium',
        path: join(this.baseDir, this.config.providers.codeium.folder, this.config.providers.codeium.filename),
        content: codeiumContent
      });
    }

    // Continue
    if (this.config.providers.continue) {
      const continueContent = this.generateContinueContent(promptContent);
      files.push({
        provider: 'continue',
        path: join(this.baseDir, this.config.providers.continue.folder, this.config.providers.continue.filename),
        content: continueContent
      });
    }

    // Aider
    if (this.config.providers.aider) {
      const aiderContent = this.generateAiderContent(promptContent);
      files.push({
        provider: 'aider',
        path: join(this.baseDir, this.config.providers.aider.folder, this.config.providers.aider.filename),
        content: aiderContent
      });
    }

    // Gemini CLI
    if (this.config.providers.gemini) {
      const geminiContent = this.generateGeminiContent(promptContent);
      files.push({
        provider: 'gemini',
        path: join(this.baseDir, this.config.providers.gemini.folder, this.config.providers.gemini.filename),
        content: geminiContent
      });
    }

    return files;
  }

  /**
   * Write provider files to disk
   */
  async writeProviderFiles(files: ProviderFile[]): Promise<void> {
    for (const file of files) {
      const dir = join(file.path, '..');
      mkdirSync(dir, { recursive: true });
      writeFileSync(file.path, file.content);
      console.log(`   ✅ Created ${file.provider} config: ${file.path}`);
    }
  }

  /**
   * Generate Claude-specific content
   */
  private generateClaudeContent(prompts: string[], includeCommands: boolean): string {
    let content = '# Claude Instructions\n\n';
    
    content += prompts.join('\n\n---\n\n');
    
    if (includeCommands) {
      content += '\n\n## Commands\n\n';
      content += 'See commands.md for available commands and usage.\n';
    }

    return content;
  }

  /**
   * Generate Claude commands documentation
   */
  private generateClaudeCommands(): string {
    return `# Claude Commands

## File Operations

### Read File
\`\`\`
/read <filepath>
\`\`\`
Read the contents of a file.

### Write File
\`\`\`
/write <filepath>
<content>
\`\`\`
Create or overwrite a file with the specified content.

### Edit File
\`\`\`
/edit <filepath>
<old_content>
---
<new_content>
\`\`\`
Replace specific content in a file.

## Project Management

### List Files
\`\`\`
/ls [directory]
\`\`\`
List files in the current or specified directory.

### Search
\`\`\`
/search <pattern>
\`\`\`
Search for files or content matching the pattern.

## Terminal

### Run Command
\`\`\`
/run <command>
\`\`\`
Execute a terminal command.

### Install Dependencies
\`\`\`
/install <package>
\`\`\`
Install npm/pip/cargo packages.

## AI Assistant

### Think Step by Step
\`\`\`
/think
\`\`\`
Break down the current problem into steps.

### Plan
\`\`\`
/plan
\`\`\`
Create a detailed plan for implementing a feature.
`;
  }

  /**
   * Generate Cursor-specific content
   */
  private generateCursorContent(prompts: string[]): string {
    return prompts.join('\n\n');
  }

  /**
   * Generate GitHub Copilot content
   */
  private generateCopilotContent(prompts: string[]): string {
    let content = '# GitHub Copilot Instructions\n\n';
    content += prompts.join('\n\n---\n\n');
    return content;
  }

  /**
   * Generate Codeium content
   */
  private generateCodeiumContent(prompts: string[]): string {
    let content = '# Codeium Instructions\n\n';
    content += prompts.join('\n\n---\n\n');
    return content;
  }

  /**
   * Generate Continue content (JSON format)
   */
  private generateContinueContent(prompts: string[]): string {
    const config = {
      rules: prompts.map(p => ({
        content: p,
        enabled: true
      })),
      customInstructions: prompts.join('\n\n')
    };
    
    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate Aider content
   */
  private generateAiderContent(prompts: string[]): string {
    let content = '# Aider Conventions\n\n';
    content += prompts.join('\n\n---\n\n');
    return content;
  }

  /**
   * Generate Gemini CLI content
   */
  private generateGeminiContent(prompts: string[]): string {
    let content = '# Gemini CLI Instructions\n\n';
    content += 'These are the instructions for Gemini CLI to follow when assisting with this project.\n\n';
    content += prompts.join('\n\n---\n\n');
    
    content += '\n\n## Gemini CLI Commands\n\n';
    content += 'Use these patterns when working with the Gemini CLI:\n\n';
    content += '```bash\n';
    content += '# Code generation\n';
    content += 'gemini code "generate a function that..."\n\n';
    content += '# Code review\n';
    content += 'gemini review file.js\n\n';
    content += '# Explain code\n';
    content += 'gemini explain "what does this code do"\n';
    content += '```\n';
    
    return content;
  }

  /**
   * Get default provider configuration
   */
  static getDefaultProviderConfig(): ProjectConfig['providers'] {
    return {
      claude: {
        folder: '.claude',
        includeCommands: true
      },
      cursor: {
        folder: '.cursor',
        filename: '.cursorrules'
      },
      copilot: {
        folder: '.github',
        filename: 'copilot-instructions.md'
      },
      codeium: {
        folder: '.codeium',
        filename: 'instructions.md'
      },
      continue: {
        folder: '.continue',
        filename: 'config.json'
      },
      aider: {
        folder: '.aider',
        filename: 'conventions.md'
      },
      gemini: {
        folder: '.gemini',
        filename: 'instructions.md'
      }
    };
  }
}