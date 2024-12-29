import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';

interface PromptMetadata {
  name: string;
  namespace: string;
  version: string;
  author: string;
  description: string;
  tags: string[];
  created: string;
}

interface PromptInfo extends PromptMetadata {
  content: string;
}

class PromptFetcher {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, repository: string) {
    this.octokit = new Octokit({ auth: token });
    const [owner, repo] = repository.split('/');
    this.owner = owner;
    this.repo = repo;
  }

  async fetchPrompt(promptSpec: string): Promise<PromptInfo> {
    const { namespace, name, version } = this.parsePromptSpec(promptSpec);
    
    if (version === 'latest') {
      return this.fetchLatestPrompt(namespace, name);
    } else {
      return this.fetchSpecificVersion(namespace, name, version);
    }
  }

  private parsePromptSpec(promptSpec: string): { namespace: string | null, name: string, version: string } {
    // Format: name@version, namespace/name@version
    const atIndex = promptSpec.lastIndexOf('@');
    if (atIndex === -1) {
      throw new Error('Invalid prompt format. Use: name@version or namespace/name@version');
    }

    const promptPath = promptSpec.substring(0, atIndex);
    const version = promptSpec.substring(atIndex + 1);

    if (promptPath.includes('/')) {
      const [namespace, name] = promptPath.split('/');
      return { namespace, name, version };
    } else {
      return { namespace: null, name: promptPath, version };
    }
  }

  private async fetchLatestPrompt(namespace: string | null, name: string): Promise<PromptInfo> {
    // Find all matching prompts
    const matchingPrompts = await this.findMatchingPrompts(namespace, name);
    
    if (matchingPrompts.length === 0) {
      throw new Error(`No prompt found: ${namespace ? namespace + '/' : ''}${name}`);
    }

    // Sort by version (semver) and get latest
    const latest = this.getLatestVersion(matchingPrompts);
    return this.fetchPromptContent(latest.namespace, latest.name, latest.version);
  }

  private async fetchSpecificVersion(namespace: string | null, name: string, version: string): Promise<PromptInfo> {
    if (namespace) {
      // Direct path lookup
      return this.fetchPromptContent(namespace, name, version);
    } else {
      // Search across all namespaces
      const matchingPrompts = await this.findMatchingPrompts(null, name);
      const exactMatch = matchingPrompts.find(p => p.version === version);
      
      if (!exactMatch) {
        throw new Error(`No prompt found: ${name}@${version}`);
      }
      
      return this.fetchPromptContent(exactMatch.namespace, exactMatch.name, exactMatch.version);
    }
  }

  private async findMatchingPrompts(namespace: string | null, name: string): Promise<PromptMetadata[]> {
    const prompts: PromptMetadata[] = [];

    try {
      if (namespace) {
        // Check specific namespace for versioned files
        await this.searchNamespaceForPrompts(namespace, name, prompts);
      } else {
        // Search all namespaces
        const { data: contents } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: '',
        });

        if (Array.isArray(contents)) {
          for (const item of contents) {
            if (item.type === 'dir') {
              await this.searchNamespaceForPrompts(item.name, name, prompts);
            }
          }
        }
      }
    } catch (error) {
      // Directory or file doesn't exist
    }

    return prompts;
  }

  private async searchNamespaceForPrompts(namespace: string, name: string, prompts: PromptMetadata[]): Promise<void> {
    try {
      const { data: files } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: namespace,
      });

      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.type === 'file' && file.name.endsWith('.md')) {
            // Check if filename matches pattern: name-version.md
            const fileNameWithoutExt = file.name.replace('.md', '');
            if (this.isVersionedFileName(fileNameWithoutExt, name)) {
              const filePath = `${namespace}/${file.name}`;
              const prompt = await this.getPromptFromFile(filePath);
              if (prompt && prompt.name === name) {
                prompts.push(prompt);
              }
            }
          }
        }
      }
    } catch (error) {
      // Namespace doesn't exist or can't read it
    }
  }

  private isVersionedFileName(fileName: string, expectedName: string): boolean {
    // Check if fileName matches pattern: expectedName-version
    const pattern = new RegExp(`^${this.escapeRegex(expectedName)}-\\d+\\.\\d+\\.\\d+$`);
    return pattern.test(fileName);
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async getPromptFromFile(filePath: string): Promise<PromptMetadata | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
      });

      if ('content' in data) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return this.parsePromptMetadata(content, filePath);
      }
    } catch (error) {
      // File doesn't exist
    }
    return null;
  }

  private parsePromptMetadata(content: string, filePath: string): PromptMetadata | null {
    const lines = content.split('\n');
    
    if (lines[0] !== '---') {
      return null; // No frontmatter
    }

    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      return null; // Invalid frontmatter
    }

    const frontmatter = lines.slice(1, endIndex);
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
      name: metadata.name || 'unknown',
      namespace: metadata.namespace || 'unknown',
      version: metadata.version || '1.0.0',
      author: metadata.author || 'unknown',
      description: metadata.description || '',
      tags: metadata.tags || [],
      created: metadata.created || ''
    };
  }

  private async fetchPromptContent(namespace: string, name: string, version: string): Promise<PromptInfo> {
    // Try versioned filename first
    const versionedFileName = `${name}-${version}.md`;
    const versionedFilePath = `${namespace}/${versionedFileName}`;
    
    let filePath = versionedFilePath;
    let data: any;
    
    try {
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: versionedFilePath,
      });
      data = response.data;
    } catch (error) {
      // If versioned file doesn't exist, fall back to non-versioned (legacy)
      const legacyFilePath = `${namespace}/${name}.md`;
      try {
        const response = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: legacyFilePath,
        });
        data = response.data;
        filePath = legacyFilePath;
      } catch (legacyError) {
        throw new Error(`Prompt not found: ${namespace}/${name}@${version}`);
      }
    }

    if (!('content' in data)) {
      throw new Error(`Invalid file type: ${filePath}`);
    }

    const fullContent = Buffer.from(data.content, 'base64').toString('utf-8');
    const metadata = this.parsePromptMetadata(fullContent, filePath);
    
    if (!metadata) {
      throw new Error(`Invalid prompt format: ${filePath}`);
    }

    if (metadata.version !== version) {
      throw new Error(`Version mismatch: expected ${version}, found ${metadata.version} in ${filePath}`);
    }

    // Extract content (without frontmatter)
    const lines = fullContent.split('\n');
    let contentStart = 0;
    
    if (lines[0] === '---') {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---') {
          contentStart = i + 1;
          break;
        }
      }
    }

    const content = lines.slice(contentStart).join('\n').trim();

    return {
      ...metadata,
      content
    };
  }

  private getLatestVersion(prompts: PromptMetadata[]): PromptMetadata {
    // Simple semver comparison - sorts by version string
    // For proper semver, you'd use a library like 'semver'
    return prompts.sort((a, b) => {
      const aVersion = this.parseVersion(a.version);
      const bVersion = this.parseVersion(b.version);
      
      if (aVersion.major !== bVersion.major) return bVersion.major - aVersion.major;
      if (aVersion.minor !== bVersion.minor) return bVersion.minor - aVersion.minor;
      return bVersion.patch - aVersion.patch;
    })[0];
  }

  private parseVersion(version: string): { major: number, minor: number, patch: number } {
    const parts = version.split('.').map(n => parseInt(n) || 0);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const promptSpec = core.getInput('prompt', { required: true });
    const repository = core.getInput('repository', { required: true });
    const token = core.getInput('token', { required: true });

    core.info(`Fetching prompt: ${promptSpec} from ${repository}`);

    // Fetch prompt
    const fetcher = new PromptFetcher(token, repository);
    const prompt = await fetcher.fetchPrompt(promptSpec);

    // Set outputs
    core.setOutput('prompt', prompt.content);
    core.setOutput('name', prompt.name);
    core.setOutput('namespace', prompt.namespace);
    core.setOutput('version', prompt.version);
    core.setOutput('author', prompt.author);
    core.setOutput('description', prompt.description);
    core.setOutput('tags', JSON.stringify(prompt.tags));
    core.setOutput('created', prompt.created);

    core.info(`✅ Successfully fetched: ${prompt.namespace}/${prompt.name}@${prompt.version}`);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : 'Unknown error');
  }
}

run();