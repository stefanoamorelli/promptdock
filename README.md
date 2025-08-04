# PromptDock

Manage AI prompts across multiple coding assistants from a single source. Stop copying the same instructions between Claude, Cursor, Copilot, and other AI tools.

## What it does

PromptDock lets you:
- Store prompts in git repositories with folder organization
- Pull prompts from any repo/namespace into your project  
- Generate configuration files for multiple AI providers automatically
- Keep everything in sync with Notion (optional)

Instead of maintaining separate `.cursorrules`, `CLAUDE.md`, and `copilot-instructions.md` files, you write prompts once and PromptDock creates all the provider-specific files.

## Supported AI Providers

| Provider | Output File | Features |
|----------|-------------|----------|
| **Claude** | `.claude/instructions.md` | Instructions + optional command docs |
| **Cursor** | `.cursor/.cursorrules` | Standard Cursor rules format |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Markdown instructions |
| **Gemini CLI** | `.gemini/instructions.md` | CLI-optimized with command examples |
| **Codeium** | `.codeium/instructions.md` | Standard format |
| **Continue** | `.continue/config.json` | JSON with rules array |
| **Aider** | `.aider/conventions.md` | Coding conventions |

## Installation

| Method | Command |
|--------|---------|
| **npm** | `npm install -g promptdock` |
| **pnpm** | `pnpm add -g promptdock` |
| **From source** | See [Development](#development) section |

## Complete Workflow

### Step 1: Installation

Install PromptDock globally:

```bash
npm install -g promptdock
# or
pnpm add -g promptdock
```

### Step 2: Set Up Your Project

Navigate to your project and run the setup wizard:

```bash
cd my-awesome-project
prompt init
```

The interactive wizard will guide you through:

#### 2.1 Project Configuration
```
? Project name: my-awesome-project
? Project description: AI prompts for web development
```

#### 2.2 AI Provider Selection
```
? Select AI providers to generate configs for:
◉ Claude (with commands)
◉ Cursor  
◉ GitHub Copilot
◯ Gemini CLI
◯ Codeium
◯ Continue
◯ Aider
```

#### 2.3 Prompt Sources
For each prompt collection you want:
```
? Prompt name: frontend-standards
? Prompt description: React and TypeScript best practices
? Global repository URL: https://github.com/company/prompts.git
? Namespace within repo: web/frontend
? Folders to create: system,user,components
```

#### 2.4 GitIgnore Configuration  
```
? Select folders to add to .gitignore:
◉ .claude
◉ .cursor
◉ .github
◯ frontend-standards/
```

This creates:
- `prompt.json` - Your project configuration
- Folder structure for prompts
- Provider folders (`.claude/`, `.cursor/`, etc.)
- Updated `.gitignore`

### Step 3: Pull Your Prompts

Download and generate all configurations:

```bash
prompt pull --all
```

Watch PromptDock work:
```
🚀 Pulling 1 prompt(s)...

📦 Processing frontend-standards...
📥 Cloning from https://github.com/company/prompts.git...
   ✅ system/architecture-principles.md
   ✅ user/code-review-checklist.md
   ✅ components/react-patterns.md
   📝 Generating provider configs...
   ✅ Created claude config: .claude/instructions.md
   ✅ Created claude config: .claude/commands.md
   ✅ Created cursor config: .cursor/.cursorrules
   ✅ Created copilot config: .github/copilot-instructions.md
   ✅ frontend-standards pulled successfully (3 files)

🎉 All prompts pulled successfully!
```

### Step 4: Your Project is Ready

Your project now has everything set up:

```
my-awesome-project/
├── prompt.json                      # PromptDock configuration
├── .gitignore                       # Updated with AI folders
├── .claude/
│   ├── instructions.md             # All prompts for Claude
│   └── commands.md                 # Claude command reference
├── .cursor/
│   └── .cursorrules               # Cursor IDE rules
├── .github/
│   └── copilot-instructions.md    # GitHub Copilot prompts
└── frontend-standards/             # Organized source prompts
    ├── system/
    │   └── architecture-principles.md
    ├── user/
    │   └── code-review-checklist.md
    └── components/
        └── react-patterns.md
```

### Step 5: Start Coding with AI

Now your AI tools automatically pick up the configurations:

| AI Tool | Configuration Location | Auto-loaded |
|---------|----------------------|-------------|
| **Claude** | `.claude/instructions.md` | ✅ Yes |
| **Cursor** | `.cursor/.cursorrules` | ✅ Yes |
| **GitHub Copilot** | `.github/copilot-instructions.md` | ✅ Yes |
| **Gemini CLI** | `.gemini/instructions.md` | Manual |

### Step 6: Keep Prompts Updated

When your team updates the prompt repository:

```bash
# Pull latest changes
prompt pull --all

# Or pull specific prompts
prompt pull --prompt frontend-standards
```

### Step 7: Team Collaboration (Optional)

Set up Notion integration for team visibility:

```bash
# One-time setup
prompt notion setup

# Sync prompts to Notion database
prompt notion sync
```

## Real-World Example

Here's what a typical `prompt.json` looks like for a React project:

```json
{
  "name": "react-dashboard",
  "description": "Enterprise dashboard with React + TypeScript",
  "prompts": [
    {
      "name": "frontend-standards",
      "description": "React, TypeScript, and component standards",
      "repo": "https://github.com/company/engineering-prompts.git",
      "namespace": "frontend/react",
      "folders": ["architecture", "components", "testing"],
      "providers": {
        "claude": { "enabled": true, "includeCommands": true },
        "cursor": { "enabled": true },
        "copilot": { "enabled": true }
      }
    },
    {
      "name": "api-integration",
      "description": "REST API and GraphQL patterns",
      "repo": "https://github.com/company/engineering-prompts.git", 
      "namespace": "backend/api",
      "folders": ["rest", "graphql", "auth"],
      "providers": {
        "claude": { "enabled": true },
        "aider": { "enabled": true }
      }
    }
  ],
  "providers": {
    "claude": { "folder": ".claude", "includeCommands": true },
    "cursor": { "folder": ".cursor", "filename": ".cursorrules" },
    "copilot": { "folder": ".github", "filename": "copilot-instructions.md" },
    "aider": { "folder": ".aider", "filename": "conventions.md" }
  },
  "gitignore": [".claude", ".cursor", ".github", ".aider", ".promptdock/"]
}
```

## Notion Integration (Optional)

Sync your prompts to a Notion database for team collaboration:

| Command | Description |
|---------|-------------|
| `prompt notion setup` | Configure Notion integration |
| `prompt notion sync` | Sync prompts to Notion database |
| `prompt notion status` | Check connection status |

## Testing PromptDock

Want to try it out? There's a test script included:

```bash
# Clone this repo
git clone https://github.com/stefanoamorelli/promptdock.git
cd promptdock

# Install and build
pnpm install && pnpm build

# Run the test
./test-script.sh
```

This creates a sample project with prompts and shows all the generated provider files.

## Development

| Task | Command |
|------|---------|
| **Install deps** | `pnpm install` |
| **Build** | `pnpm build` |
| **Dev mode** | `pnpm dev` |
| **Test** | `./test-script.sh` |

### Project Structure

```
src/
├── commands/          # CLI commands
│   ├── init.ts       # Interactive setup
│   ├── enhanced-pull.ts  # Multi-provider pull
│   └── notion-sync.ts    # Notion integration
├── lib/
│   ├── config.ts     # Configuration types
│   ├── providers.ts  # Provider-specific generators
│   └── notion-plugin.ts  # Notion API integration
└── index.ts          # Main CLI entry
```

## Common Use Cases

| Scenario | Setup |
|----------|-------|
| **Team standards** | Shared repo with coding standards per language/framework |  
| **Project templates** | Starter prompts for new projects |
| **Personal workflow** | Your own prompt library synced across projects |
| **Enterprise** | Company-wide prompt standards with Notion tracking |

## Why PromptDock?

Instead of this mess:
```bash
# Copy prompts manually to each project
cp ~/.prompts/react-rules.md ./CLAUDE.md
cp ~/.prompts/react-rules.md ./.cursorrules  
cp ~/.prompts/react-rules.md ./.github/copilot-instructions.md
# Repeat for every project...
```

You get this:
```bash
prompt init    # One-time setup
prompt pull --all  # Auto-generates all provider files
```

## Contributing

Found a bug or want to add a provider? PRs welcome!

## License

ISC License

---
Made by [Stefano Amorelli](https://amorelli.tech)