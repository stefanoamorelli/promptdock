import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const CONFIG_PATH = join(homedir(), '.config', 'promptdock', 'config.json');

export interface GlobalConfig {
  origin: string;
  local: string;
}

export type Provider = 'claude' | 'cursor' | 'copilot' | 'codeium' | 'continue' | 'aider' | 'gemini';

export interface ProviderConfig {
  enabled: boolean;
  outputPath?: string;      // Custom output path for this provider
  outputFormat?: string;    // Custom output format/filename
  includeCommands?: boolean; // For Claude - include command instructions
}

export interface PromptConfig {
  name: string;
  description: string;
  repo: string;           // Global repo URL (e.g., "https://github.com/user/prompts.git")
  namespace: string;      // Namespace/path within the repo (e.g., "web", "backend", "mobile")
  folders: string[];      // Local folder structure to create
  providers: Record<Provider, ProviderConfig>; // Provider-specific configurations
}

export interface ProjectConfig {
  name: string;
  description: string;
  prompts: PromptConfig[];
  gitignore: string[];
  providers: {
    claude: {
      folder: string;         // Default: .claude
      includeCommands: boolean; // Include Claude command docs
    };
    cursor: {
      folder: string;         // Default: .cursor
      filename: string;       // Default: .cursorrules
    };
    copilot: {
      folder: string;         // Default: .github
      filename: string;       // Default: copilot-instructions.md
    };
    codeium: {
      folder: string;         // Default: .codeium
      filename: string;       // Default: instructions.md
    };
    continue: {
      folder: string;         // Default: .continue
      filename: string;       // Default: config.json (with rules section)
    };
    aider: {
      folder: string;         // Default: .aider
      filename: string;       // Default: conventions.md
    };
    gemini: {
      folder: string;         // Default: .gemini
      filename: string;       // Default: instructions.md
    };
  };
}

export function writeConfig(cfg: GlobalConfig) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export function readConfig(): GlobalConfig | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null;
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function readProjectConfig(path?: string): ProjectConfig | null {
  try {
    const configPath = join(path || process.cwd(), 'prompt.json');
    if (!existsSync(configPath)) return null;
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

