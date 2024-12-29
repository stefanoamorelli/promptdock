# PromptDock

A lightweight CLI tool to manage, version, and share reusable AI prompts through a Git-backed registry. PromptDock helps developers organize and collaborate on prompts for AI tools like Claude, Cursor, and other AI assistants.

## Features

- 📦 **Git-backed storage** - All prompts are stored in a Git repository for version control and collaboration
- 🏷️ **Namespace organization** - Organize prompts by categories (web, backend, mobile, etc.)
- 🔄 **Version management** - Track prompt versions and changes over time
- 🏗️ **Format support** - Import from Claude (.md, .claude) and Cursor (.cursorrules, .mdc) files
- 🚀 **CI/CD integration** - Easily integrate prompts into your workflows
- 📝 **Metadata tracking** - Author, tags, descriptions, and creation dates
- 🔍 **Easy discovery** - List and search through your prompt library

## Installation

### Prerequisites

- Node.js (v18 or higher)
- Git installed and configured
- GitHub CLI (`gh`) installed and authenticated (for author detection)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/promptdock.git
cd promptdock

# Install dependencies
pnpm install

# Build the TypeScript files
pnpm build

# Run in development mode
pnpm dev

# Or after building, run the compiled version
pnpm start
```

## Usage

### Initialize PromptDock

First, set up PromptDock with your prompt repository:

```bash
prompt init --origin https://github.com/yourusername/prompt-library.git
```

This will:
- Clone your prompt repository to `~/.config/promptdock/prompts`
- Create a configuration file at `~/.config/promptdock/config.json`

You can specify a custom directory:

```bash
prompt init --origin https://github.com/yourusername/prompt-library.git --dir /custom/path
```

### Create a New Prompt

Create a new prompt with metadata:

```bash
prompt new --namespace web --name "react-component" --version 1.0.0 --description "React component best practices"
```

Options:
- `--namespace` (required): Category for the prompt (e.g., web, backend, mobile)
- `--name` (required): Prompt name (will be sanitized to lowercase with hyphens)
- `--version` (required): Semantic version (e.g., 1.0.0)
- `--description` (required): Brief description of the prompt
- `--author`: Author name (defaults to GitHub username)
- `--tags`: Comma-separated tags (e.g., "react,typescript,frontend")
- `--dry-run`: Create locally without pushing to Git

The command will:
1. Create a new markdown file with frontmatter
2. Open your default editor (`$EDITOR` or nano)
3. Validate the prompt structure
4. Optionally commit and push to your Git repository

### Import Existing Prompts

Import Claude or Cursor configuration files into your prompt library:

```bash
# Import a Claude.md file
prompt pull /path/to/CLAUDE.md --namespace web

# Import a .cursorrules file
prompt pull /path/to/.cursorrules --namespace backend

# Copy to local project instead of prompt library
prompt pull /path/to/CLAUDE.md --to-local

# Split a file into multiple prompts (one per section)
prompt pull /path/to/rules.md --namespace mobile --split

# Dry run to preview what would be imported
prompt pull /path/to/file.md --namespace test --dry-run
```

Options:
- `--namespace`: Target namespace for the prompt
- `--name`: Custom name (defaults to auto-detected)
- `--to-local`: Copy to project directory (CLAUDE.md or .cursorrules)
- `--split`: Split into multiple prompts by sections
- `--output`: Custom output path
- `--dry-run`: Preview without making changes

### List Prompts

View all prompts in your library:

```bash
# List all prompts
prompt list

# List prompts in a specific namespace
prompt list --namespace web

# Search prompts by tag
prompt list --tag react

# Show detailed information
prompt list --verbose
```

### Edit Prompts

Edit an existing prompt:

```bash
# Edit by name and namespace
prompt edit --namespace web --name react-component

# Edit specific version
prompt edit --namespace web --name react-component --version 1.0.0
```

### Delete Prompts

Remove prompts from your library:

```bash
# Delete a specific prompt
prompt delete --namespace web --name old-prompt

# Delete with confirmation
prompt delete --namespace backend --name deprecated-api
```

### Sync Repository

Keep your local prompt library in sync:

```bash
# Pull latest changes from remote
prompt sync

# Check status of local changes
prompt status
```

### Push Changes

Push local changes to the remote repository:

```bash
prompt push
```

## Prompt Format

Prompts are stored as markdown files with YAML frontmatter:

```markdown
---
name: react-hooks
namespace: web
version: 1.0.0
author: John Doe
description: Best practices for React hooks
created: 2024-01-15
tags: ["react", "hooks", "javascript"]
---

# React Hooks Best Practices

Your prompt content goes here...
```

### Required Fields

- `name`: Sanitized prompt name (lowercase, hyphens)
- `namespace`: Category/namespace
- `version`: Semantic version
- `author`: Prompt author
- `description`: Brief description
- `created`: Creation date (YYYY-MM-DD)

### Optional Fields

- `tags`: Array of tags for categorization

## Directory Structure

```
~/.config/promptdock/
├── config.json          # PromptDock configuration
└── prompts/            # Git repository with prompts
    ├── web/
    │   ├── react-component-1.0.0.md
    │   └── vue-setup-2.0.0.md
    ├── backend/
    │   ├── api-design-1.0.0.md
    │   └── database-schema-1.1.0.md
    └── mobile/
        └── react-native-1.0.0.md
```

## CI/CD Integration

PromptDock can be integrated into your CI/CD pipeline to automatically fetch and apply prompts:

```bash
# In your CI script
prompt init --origin $PROMPT_REPO_URL
prompt pull $NAMESPACE/$NAME --to-local --output ./CLAUDE.md
```

## Configuration

The configuration file is stored at `~/.config/promptdock/config.json`:

```json
{
  "origin": "https://github.com/yourusername/prompt-library.git",
  "local": "/home/user/.config/promptdock/prompts"
}
```

## Development

```bash
# Run in development mode
pnpm dev

# Build TypeScript
pnpm build

# Clean build directory
pnpm clean

# Run specific command in dev
pnpm dev -- list --namespace web

# After building, test the CLI
./dist/index.js --help
```

## Best Practices

1. **Use semantic versioning** - Track prompt evolution with proper versions
2. **Organize by namespace** - Group related prompts together
3. **Write clear descriptions** - Help others understand prompt purpose
4. **Tag appropriately** - Make prompts discoverable
5. **Commit messages** - Use clear commit messages when updating prompts
6. **Review changes** - Always review prompts before pushing

## Troubleshooting

### "No configuration found"

Run `prompt init` first to set up PromptDock with your repository.

### "Could not get GitHub user info"

Ensure you're logged in with GitHub CLI:
```bash
gh auth login
```

### Editor not opening

Set your preferred editor:
```bash
export EDITOR=vim  # or code, nano, etc.
```

## License

ISC License - see package.json for details

## Author

Stefano Amorelli - [stefano@amorelli.tech](mailto:stefano@amorelli.tech) - [https://amorelli.tech](https://amorelli.tech)