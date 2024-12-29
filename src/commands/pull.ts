import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { homedir } from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import simpleGit from 'simple-git';
import readline from 'readline';

const cmd = new Command('pull');
const execAsync = promisify(exec);

interface ImportedPrompt {
  name: string;
  namespace: string;
  version: string;
  author: string;
  description: string;
  content: string;
  tags: string[];
  fileType: 'claude' | 'cursor';
}

async function getGitHubAuthor(): Promise<string> {
  try {
    const { stdout } = await execAsync('gh api user --jq .name');
    return stdout.trim();
  } catch (error) {
    console.warn('⚠️  Could not get GitHub user info. Make sure you are logged in with `gh auth login`');
    return 'Unknown';
  }
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}

function detectFileType(filePath: string, content: string): 'claude' | 'cursor' {
  const ext = extname(filePath).toLowerCase();
  const fileName = basename(filePath).toLowerCase();
  
  // Check by file extension/name
  if (ext === '.claude' || fileName === 'claude.md' || fileName.includes('claude')) {
    return 'claude';
  }
  if (ext === '.cursorrules' || fileName === '.cursorrules' || ext === '.mdc') {
    return 'cursor';
  }
  
  // Check by content patterns
  if (content.includes('cursorrules') || content.includes('cursor') || content.includes('code_style') || content.includes('ai_reasoning')) {
    return 'cursor';
  }
  
  // Default to claude for markdown files
  return 'claude';
}

function parseClaudeFile(content: string, filePath: string): ImportedPrompt {
  const lines = content.split('\n');
  let frontmatterEnd = -1;
  let title = '';
  let description = '';
  let tags: string[] = [];
  
  // Check for YAML frontmatter
  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---' || lines[i] === '...') {
        frontmatterEnd = i;
        break;
      }
      
      // Parse common frontmatter fields
      const line = lines[i];
      if (line.startsWith('title:')) {
        title = line.substring(6).trim().replace(/['"]/g, '');
      } else if (line.startsWith('description:')) {
        description = line.substring(12).trim().replace(/['"]/g, '');
      } else if (line.startsWith('tags:')) {
        const tagsStr = line.substring(5).trim();
        if (tagsStr.startsWith('[') && tagsStr.endsWith(']')) {
          try {
            tags = JSON.parse(tagsStr);
          } catch {
            tags = tagsStr.slice(1, -1).split(',').map(t => t.trim().replace(/['"]/g, ''));
          }
        }
      }
    }
  }
  
  // Extract content (everything after frontmatter)
  const contentStart = frontmatterEnd === -1 ? 0 : frontmatterEnd + 1;
  const mainContent = lines.slice(contentStart).join('\n').trim();
  
  // If no title from frontmatter, try to extract from first heading
  if (!title) {
    const firstHeading = lines.find(line => line.startsWith('#'));
    if (firstHeading) {
      title = firstHeading.replace(/^#+\s*/, '').trim();
    }
  }
  
  // Fallback naming
  if (!title) {
    title = basename(filePath, extname(filePath));
  }
  if (!description) {
    description = 'Pulled Claude prompt';
  }
  
  return {
    name: sanitizeFilename(title),
    namespace: 'imported', // Default, will be overridden
    version: '1.0.0',
    author: 'Imported',
    description,
    content: mainContent,
    tags: tags.length > 0 ? tags : ['claude', 'pulled'],
    fileType: 'claude'
  };
}

function parseCursorFile(content: string, filePath: string): ImportedPrompt {
  const lines = content.split('\n');
  let frontmatterEnd = -1;
  let description = '';
  let tags: string[] = ['cursor', 'rules', 'imported'];
  
  // Check for .mdc frontmatter
  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        frontmatterEnd = i;
        break;
      }
      
      const line = lines[i];
      if (line.startsWith('description:')) {
        description = line.substring(12).trim().replace(/['"]/g, '');
      }
    }
  }
  
  // Extract content
  const contentStart = frontmatterEnd === -1 ? 0 : frontmatterEnd + 1;
  const mainContent = lines.slice(contentStart).join('\n').trim();
  
  // Generate name from file or content
  let name = basename(filePath, extname(filePath));
  if (name === '.cursorrules') {
    name = 'cursor-rules';
  }
  
  if (!description) {
    description = 'Pulled Cursor rules';
  }
  
  return {
    name: sanitizeFilename(name),
    namespace: 'imported', // Default, will be overridden
    version: '1.0.0',
    author: 'Imported',
    description,
    content: mainContent,
    tags: ['cursor', 'rules', 'pulled'],
    fileType: 'cursor'
  };
}

function splitIntoSections(content: string, fileType: 'claude' | 'cursor'): { title: string, content: string }[] {
  const sections: { title: string, content: string }[] = [];
  const lines = content.split('\n');
  
  let currentSection: { title: string, content: string } | null = null;
  let inFrontmatter = false;
  let frontmatterEnd = -1;
  
  // Skip frontmatter if present
  if (lines[0] === '---') {
    inFrontmatter = true;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---' || lines[i] === '...') {
        frontmatterEnd = i;
        inFrontmatter = false;
        break;
      }
    }
  }
  
  const startLine = frontmatterEnd === -1 ? 0 : frontmatterEnd + 1;
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for section headers
    if (line.startsWith('#') || (fileType === 'cursor' && line.match(/^[A-Z_][A-Z_\s]*:?\s*$/))) {
      // Save previous section
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }
      
      // Start new section
      let title = line.startsWith('#') 
        ? line.replace(/^#+\s*/, '').trim()
        : line.replace(/:?\s*$/, '').trim().toLowerCase().replace(/\s+/g, '-');
        
      currentSection = {
        title: title || `section-${sections.length + 1}`,
        content: ''
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    } else {
      // Content before any header
      if (!currentSection) {
        currentSection = {
          title: fileType === 'claude' ? 'main-context' : 'general-rules',
          content: ''
        };
      }
      currentSection.content += line + '\n';
    }
  }
  
  // Add last section
  if (currentSection && currentSection.content.trim()) {
    sections.push(currentSection);
  }
  
  return sections.filter(s => s.content.trim().length > 0);
}

function copyToLocalProject(content: string, fileType: 'claude' | 'cursor', customPath?: string): string {
  const cwd = process.cwd();
  let targetPath: string;
  
  if (customPath) {
    targetPath = customPath;
  } else {
    targetPath = fileType === 'claude' 
      ? join(cwd, 'CLAUDE.md')
      : join(cwd, '.cursorrules');
  }
  
  // Write the content directly (without our prompt headers)
  writeFileSync(targetPath, content);
  return targetPath;
}

function validateHeader(content: string): boolean {
  const lines = content.split('\n');
  if (lines[0] !== '---') return false;
  
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex === -1) return false;
  
  const headerLines = lines.slice(1, endIndex);
  const requiredFields = ['name', 'namespace', 'version', 'author', 'description', 'created'];
  
  for (const field of requiredFields) {
    if (!headerLines.some(line => line.startsWith(`${field}:`))) {
      console.error(`❌ Missing required field: ${field}`);
      return false;
    }
  }
  
  return true;
}

cmd
  .argument('<file>', 'Path to Claude (.md/.claude) or Cursor (.cursorrules/.mdc) file to pull')
  .option('--namespace <namespace>', 'Target namespace for prompt repo (e.g. web, be, mobile)')
  .option('--name <name>', 'Custom prompt name (default: auto-detected)')
  .option('--to-local', 'Copy to local project file (CLAUDE.md or .cursorrules) instead of prompt repo')
  .option('--split', 'Split into multiple prompts (one per section/rule)')
  .option('--output <path>', 'Custom output file path')
  .option('--dry-run', 'Show what would be pulled without actually pulling')
  .action(async (filePath, { namespace, name, toLocal, split, output, dryRun }) => {
    try {
      // Check if input file exists
      if (!existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return;
      }
      
      // Read and parse file
      const content = readFileSync(filePath, 'utf-8');
      const fileType = detectFileType(filePath, content);
      
      console.log(`📥 Detected file type: ${fileType.toUpperCase()}`);
      
      let parsed: ImportedPrompt;
      if (fileType === 'claude') {
        parsed = parseClaudeFile(content, filePath);
      } else {
        parsed = parseCursorFile(content, filePath);
      }
      
      console.log(`📝 Parsed prompt:`);
      console.log(`   Name: ${parsed.name}`);
      console.log(`   Namespace: ${parsed.namespace}`);
      console.log(`   Description: ${parsed.description}`);
      console.log(`   Tags: ${parsed.tags.join(', ')}`);
      
      if (dryRun) {
        console.log('🔍 Dry run: Nothing was actually pulled');
        
        if (toLocal) {
          const targetPath = fileType === 'claude' ? './CLAUDE.md' : './.cursorrules';
          console.log(`   Would copy to: ${targetPath}`);
        } else if (split) {
          const sections = splitIntoSections(parsed.content, fileType);
          console.log(`   Would split into ${sections.length} prompts:`);
          for (const section of sections) {
            console.log(`     - ${section.title}`);
          }
        } else {
          console.log(`   Would create prompt: ${parsed.namespace}/${parsed.name}`);
        }
        return;
      }
      
      // Handle --to-local option
      if (toLocal) {
        const targetPath = copyToLocalProject(parsed.content, fileType, output);
        console.log(`✅ Copied to local project: ${targetPath}`);
        return;
      }
      
      // Handle --split option
      if (split) {
        const sections = splitIntoSections(parsed.content, fileType);
        console.log(`📝 Found ${sections.length} sections to split:`);
        for (const section of sections) {
          console.log(`   • ${section.title}`);
        }
        
        // Ask for namespace for all sections
        let targetNamespace = namespace;
        if (!targetNamespace) {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          targetNamespace = await new Promise<string>((resolve) => {
            rl.question('\n📂 Enter namespace for these prompts (e.g. web, be, mobile): ', resolve);
          });
          rl.close();
          
          if (!targetNamespace.trim()) {
            console.log('❌ Namespace is required.');
            return;
          }
          targetNamespace = targetNamespace.trim();
        }
        
        // Create each section as a separate prompt
        const configPath = join(homedir(), '.config', 'promptdock', 'config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        const repoPath = config.local;
        const author = await getGitHubAuthor();
        const today = new Date().toISOString().split('T')[0];
        
        const createdFiles: string[] = [];
        
        for (const section of sections) {
          const sanitizedName = sanitizeFilename(section.title);
          const promptDir = join(repoPath, targetNamespace);
          const outputPath = join(promptDir, `${sanitizedName}.md`);
          
          // Create directory
          mkdirSync(promptDir, { recursive: true });
          
          // Check if exists
          if (existsSync(outputPath)) {
            console.log(`⚠️  Skipping ${section.title} - already exists`);
            continue;
          }
          
          const tags = fileType === 'claude' 
            ? ['claude', 'pulled', 'split']
            : ['cursor', 'rules', 'pulled', 'split'];
          
          const finalContent = `---
name: ${sanitizedName}
namespace: ${targetNamespace}
version: 1.0.0
author: ${author}
description: Split from ${basename(filePath)} - ${section.title}
created: ${today}
tags: [${tags.map(tag => `"${tag}"`).join(', ')}]
---

${section.content.trim()}`;
          
          writeFileSync(outputPath, finalContent);
          console.log(`✅ Created: ${targetNamespace}/${sanitizedName}`);
          createdFiles.push(join(targetNamespace, `${sanitizedName}.md`));
        }
        
        if (createdFiles.length > 0) {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const commitAnswer = await new Promise<string>((resolve) => {
            rl.question(`🚀 Do you want to commit and push these ${createdFiles.length} split prompts? (y/N): `, resolve);
          });
          rl.close();
          
          if (commitAnswer.toLowerCase() === 'y' || commitAnswer.toLowerCase() === 'yes') {
            const git = simpleGit(repoPath);
            
            for (const file of createdFiles) {
              await git.add(file);
            }
            
            await git.commit(`Split ${fileType} file into ${createdFiles.length} prompts`);
            await git.push('origin', 'main');
            
            console.log(`✅ ${createdFiles.length} split prompts committed and pushed successfully!`);
          } else {
            console.log(`📝 ${createdFiles.length} split prompts created locally only`);
          }
        }
        
        return;
      }
      
      // Standard single prompt creation
      // Ask for namespace if not provided
      let targetNamespace = namespace;
      if (!targetNamespace) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        targetNamespace = await new Promise<string>((resolve) => {
          rl.question('\n📂 Enter namespace for this prompt (e.g. web, be, mobile): ', resolve);
        });
        rl.close();
        
        if (!targetNamespace.trim()) {
          console.log('❌ Namespace is required.');
          return;
        }
        targetNamespace = targetNamespace.trim();
      }
      
      // Override with options
      parsed.namespace = targetNamespace;
      if (name) parsed.name = sanitizeFilename(name);
      
      // Get config and setup paths
      const configPath = join(homedir(), '.config', 'promptdock', 'config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const repoPath = config.local;
      
      let outputPath: string;
      if (output) {
        outputPath = output;
      } else {
        const promptDir = join(repoPath, parsed.namespace);
        outputPath = join(promptDir, `${parsed.name}.md`);
      }
      
      // Check if file already exists
      if (existsSync(outputPath)) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>((resolve) => {
          rl.question(`❓ File ${outputPath} already exists. Overwrite? (y/N): `, resolve);
        });
        rl.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Pull cancelled.');
          return;
        }
      }
      
      // Get author
      const author = await getGitHubAuthor();
      
      // Create directory if needed
      mkdirSync(dirname(outputPath), { recursive: true });
      
      // Create prompt file with header
      const today = new Date().toISOString().split('T')[0];
      const tagsStr = parsed.tags.length > 0 ? `\ntags: [${parsed.tags.map(tag => `"${tag}"`).join(', ')}]` : '';
      
      const finalContent = `---
name: ${parsed.name}
namespace: ${parsed.namespace}
version: ${parsed.version}
author: ${author}
description: ${parsed.description}
created: ${today}${tagsStr}
---

${parsed.content}`;
      
      // Write file
      writeFileSync(outputPath, finalContent);
      
      // Validate
      if (!validateHeader(finalContent)) {
        console.error('❌ Invalid header format generated');
        return;
      }
      
      console.log(`✅ Pulled to: ${outputPath}`);
      
      // Ask about git commit
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const commitAnswer = await new Promise<string>((resolve) => {
        rl.question('🚀 Do you want to commit and push this pull? (y/N): ', resolve);
      });
      rl.close();
      
      if (commitAnswer.toLowerCase() === 'y' || commitAnswer.toLowerCase() === 'yes') {
        const git = simpleGit(repoPath);
        const relativeFile = join(parsed.namespace, `${parsed.name}.md`);
        
        await git.add(relativeFile);
        await git.commit(`Pull ${fileType} prompt: ${parsed.namespace}/${parsed.name}`);
        await git.push('origin', 'main');
        
        console.log('✅ Prompt pulled and pushed successfully!');
      } else {
        console.log('📝 Prompt pulled locally only');
      }
      
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT' && (error as any).path?.includes('config.json')) {
        console.error('❌ No configuration found. Run "promptdock init" first.');
      } else {
        console.error('❌ Failed to pull:', error instanceof Error ? error.message : String(error));
      }
    }
  });

export default cmd;