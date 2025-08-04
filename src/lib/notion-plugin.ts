import { Client } from '@notionhq/client';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

export interface NotionConfig {
  token: string;
  databaseId: string;
  syncEnabled: boolean;
}

export interface PromptMetadata {
  name: string;
  namespace: string;
  version: string;
  author: string;
  description: string;
  created: string;
  tags: string[];
  content: string;
  filePath: string;
  folder: string;
}

export class NotionPlugin {
  private notion: Client;
  private databaseId: string;

  constructor(config: NotionConfig) {
    this.notion = new Client({ auth: config.token });
    this.databaseId = config.databaseId;
  }

  /**
   * Scan directory for prompts in the new folder structure
   */
  async scanPrompts(baseDir: string): Promise<PromptMetadata[]> {
    const prompts: PromptMetadata[] = [];

    // Look for prompt folders in base directory
    const entries = readdirSync(baseDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const promptDir = join(baseDir, entry.name);
        
        // Scan subfolders for prompts
        const subFolders = readdirSync(promptDir, { withFileTypes: true });
        
        for (const subFolder of subFolders) {
          if (subFolder.isDirectory()) {
            const folderPath = join(promptDir, subFolder.name);
            const folderPrompts = await this.scanFolderPrompts(folderPath, entry.name, subFolder.name);
            prompts.push(...folderPrompts);
          }
        }
      }
    }

    return prompts;
  }

  /**
   * Scan a specific folder for prompts
   */
  private async scanFolderPrompts(folderPath: string, promptName: string, folder: string): Promise<PromptMetadata[]> {
    const prompts: PromptMetadata[] = [];

    if (!existsSync(folderPath)) return prompts;

    const files = readdirSync(folderPath);
    
    for (const file of files) {
      if (file.endsWith('.md') && file !== 'documentation.md') {
        const filePath = join(folderPath, file);
        const fileContent = readFileSync(filePath, 'utf-8');
        
        try {
          // Try to parse as frontmatter first (for pulled prompts)
          const parsed = matter(fileContent);
          
          if (parsed.data && Object.keys(parsed.data).length > 0) {
            // Has frontmatter - this is a pulled prompt
            prompts.push({
              name: parsed.data.name || file.replace('.md', ''),
              namespace: parsed.data.namespace || promptName,
              version: parsed.data.version || '1.0.0',
              author: parsed.data.author || 'Unknown',
              description: parsed.data.description || 'No description',
              created: parsed.data.created || new Date().toISOString().split('T')[0],
              tags: parsed.data.tags || [folder],
              content: parsed.content,
              filePath,
              folder
            });
          } else {
            // No frontmatter - this is a local prompt
            prompts.push({
              name: file.replace('.md', ''),
              namespace: promptName,
              version: '1.0.0',
              author: 'Local',
              description: `Local prompt from ${folder} folder`,
              created: new Date().toISOString().split('T')[0],
              tags: [folder, 'local'],
              content: fileContent,
              filePath,
              folder
            });
          }
        } catch (error) {
          console.warn(`⚠️  Could not parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return prompts;
  }

  /**
   * Create or update database properties to match our prompt structure
   */
  async setupDatabase(): Promise<void> {
    try {
      await this.notion.databases.update({
        database_id: this.databaseId,
        properties: {
          'Name': {
            title: {}
          },
          'Namespace': {
            select: {
              options: []
            }
          },
          'Folder': {
            select: {
              options: []
            }
          },
          'Version': {
            rich_text: {}
          },
          'Author': {
            rich_text: {}
          },
          'Description': {
            rich_text: {}
          },
          'Created': {
            date: {}
          },
          'Tags': {
            multi_select: {
              options: []
            }
          },
          'Content': {
            rich_text: {}
          },
          'File Path': {
            rich_text: {}
          },
          'Last Synced': {
            date: {}
          }
        }
      });
      console.log('✅ Notion database properties updated');
    } catch (error) {
      throw new Error(`Failed to setup database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sync all prompts to Notion database
   */
  async syncPrompts(prompts: PromptMetadata[]): Promise<void> {
    console.log(`🔄 Syncing ${prompts.length} prompts to Notion...`);

    // Get existing pages to avoid duplicates
    const existingPages = await this.getExistingPages();
    
    let created = 0;
    let updated = 0;

    for (const prompt of prompts) {
      try {
        const existingPage = existingPages.find(page => 
          this.getPropertyValue(page, 'Name') === prompt.name &&
          this.getPropertyValue(page, 'Namespace') === prompt.namespace &&
          this.getPropertyValue(page, 'Folder') === prompt.folder
        );

        if (existingPage) {
          // Update existing page
          await this.updatePrompt(existingPage.id, prompt);
          updated++;
        } else {
          // Create new page
          await this.createPrompt(prompt);
          created++;
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${prompt.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`✅ Notion sync complete: ${created} created, ${updated} updated`);
  }

  /**
   * Get existing pages from the database
   */
  private async getExistingPages(): Promise<any[]> {
    const pages: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        start_cursor: startCursor
      });

      pages.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    return pages;
  }

  /**
   * Create a new prompt in Notion
   */
  private async createPrompt(prompt: PromptMetadata): Promise<void> {
    await this.notion.pages.create({
      parent: {
        database_id: this.databaseId
      },
      properties: {
        'Name': {
          title: [{ text: { content: prompt.name } }]
        },
        'Namespace': {
          select: { name: prompt.namespace }
        },
        'Folder': {
          select: { name: prompt.folder }
        },
        'Version': {
          rich_text: [{ text: { content: prompt.version } }]
        },
        'Author': {
          rich_text: [{ text: { content: prompt.author } }]
        },
        'Description': {
          rich_text: [{ text: { content: prompt.description } }]
        },
        'Created': {
          date: { start: prompt.created }
        },
        'Tags': {
          multi_select: prompt.tags.map(tag => ({ name: tag }))
        },
        'Content': {
          rich_text: [{ text: { content: prompt.content.substring(0, 2000) } }] // Notion has limits
        },
        'File Path': {
          rich_text: [{ text: { content: prompt.filePath } }]
        },
        'Last Synced': {
          date: { start: new Date().toISOString().split('T')[0] }
        }
      }
    });
  }

  /**
   * Update an existing prompt in Notion
   */
  private async updatePrompt(pageId: string, prompt: PromptMetadata): Promise<void> {
    await this.notion.pages.update({
      page_id: pageId,
      properties: {
        'Version': {
          rich_text: [{ text: { content: prompt.version } }]
        },
        'Author': {
          rich_text: [{ text: { content: prompt.author } }]
        },
        'Description': {
          rich_text: [{ text: { content: prompt.description } }]
        },
        'Tags': {
          multi_select: prompt.tags.map(tag => ({ name: tag }))
        },
        'Content': {
          rich_text: [{ text: { content: prompt.content.substring(0, 2000) } }]
        },
        'Last Synced': {
          date: { start: new Date().toISOString().split('T')[0] }
        }
      }
    });
  }

  /**
   * Get property value from a Notion page
   */
  private getPropertyValue(page: any, propertyName: string): string {
    const property = page.properties[propertyName];
    if (!property) return '';

    switch (property.type) {
      case 'title':
        return property.title[0]?.text?.content || '';
      case 'rich_text':
        return property.rich_text[0]?.text?.content || '';
      case 'select':
        return property.select?.name || '';
      default:
        return '';
    }
  }

  /**
   * Test the connection to Notion
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.notion.databases.retrieve({ database_id: this.databaseId });
      return true;
    } catch {
      return false;
    }
  }
}