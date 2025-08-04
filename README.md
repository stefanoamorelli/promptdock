# PromptDock

Manage AI prompts across multiple coding assistants from a single source. Stop copying the same instructions between Claude, Cursor, Copilot, and other AI tools.

## What it does

PromptDock lets you:
- Store prompts in git repositories with folder organization
- Pull prompts from any repo/namespace into your project  
- Generate configuration files for multiple AI providers automatically
- Keep everything in sync with Notion (optional)

Instead of maintaining separate `.cursorrules`, `CLAUDE.md`, and `copilot-instructions.md` files, you write prompts once and PromptDock creates all the provider-specific files.

## Two Ways to Use PromptDock

### 1. **Project Mode** (Recommended)
- Run `prompt init` in your project directory
- Creates a `prompt.json` config file
- Pull prompts from any repository into your project
- Each project can use different prompts from different sources

### 2. **Global Mode** (For Prompt Authors)
- Run `prompt init --global --origin <repo-url>`
- Manage a central prompt library
- Create, edit, and push prompts to your repository
- Use commands like `prompt new`, `prompt edit`, `prompt push`

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

### Part A: Create Your Prompt Repository (One-Time Setup)

Before using PromptDock in projects, you need a central repository for your prompts:

#### 1. Create a Git Repository

```bash
# Create a new repo for your prompts
mkdir my-prompt-library
cd my-prompt-library
git init

# Create namespace folders (categories)
mkdir -p web/frontend web/backend mobile/react-native devops/docker

# Create your first prompt
cat > web/frontend/react-components.md << 'EOF'
# React Component Guidelines

Always use functional components with TypeScript:

```tsx
interface Props {
  title: string;
  onClick: () => void;
}

export const Button: React.FC<Props> = ({ title, onClick }) => {
  return <button onClick={onClick}>{title}</button>;
};
```

Follow these patterns:
- Use explicit types, no `any`
- Destructure props in function signature
- Export named components
EOF

# Commit and push
git add .
git commit -m "Initial prompts"
git remote add origin https://github.com/yourusername/my-prompt-library.git
git push -u origin main
```

#### 2. Repository Structure

Your prompt repository should follow this structure:

```
my-prompt-library/
├── web/
│   ├── frontend/
│   │   ├── react-components.md
│   │   ├── typescript-patterns.md
│   │   └── testing-guide.md
│   └── backend/
│       ├── api-design.md
│       └── database-patterns.md
├── mobile/
│   └── react-native/
│       └── navigation.md
└── devops/
    └── docker/
        └── best-practices.md
```

**Key Points:**
- Use folders as namespaces (web, mobile, devops)
- Sub-folders for more specific categories
- Plain markdown files (no frontmatter needed)
- Descriptive filenames

### Part B: Global PromptDock Setup (Optional)

If you want to manage prompts globally (not per-project):

```bash
# Set up global configuration
prompt init --global --origin https://github.com/yourusername/my-prompt-library.git

# This creates ~/.config/promptdock/config.json
```

Now you can use these commands from anywhere:

| Command | Description | Example |
|---------|-------------|---------|
| `prompt list` | List all prompts in your library | `prompt list` |
| `prompt list --namespace web` | List prompts in specific namespace | `prompt list --namespace web/frontend` |
| `prompt new` | Create new prompt with editor | `prompt new --namespace web/frontend --name vue-patterns --version 1.0.0` |
| `prompt edit` | Edit existing prompt | `prompt edit --namespace web/frontend --name react-components` |
| `prompt delete` | Remove a prompt | `prompt delete --namespace web/frontend --name old-patterns` |
| `prompt push` | Push changes to remote repository | `prompt push` |
| `prompt sync` | Pull latest changes from remote | `prompt sync` |
| `prompt status` | Check git status of prompts | `prompt status` |

**Example: Creating a New Prompt**
```bash
# This opens your editor to write the prompt
prompt new --namespace backend/python --name django-patterns --version 1.0.0 --description "Django best practices"

# After you save and close the editor:
# - Validates the prompt
# - Asks if you want to commit and push
# - Updates your remote repository
```

### Part C: Project Setup (What You Actually Use Daily)

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

### Step 7: Team Collaboration with Notion (Optional)

#### 7.1 Create a Notion Database

First, create a database in Notion:
1. Create a new page in Notion
2. Add a database (table/gallery/board)
3. Get the database ID from the URL:
   ```
   https://notion.so/myworkspace/a1b2c3d4e5f6?v=...
                                 ^^^^^^^^^^^^^^^^
                                 This is your database ID
   ```

#### 7.2 Set Up Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Give it a name (e.g., "PromptDock")
4. Copy the "Internal Integration Token"
5. Share your database with the integration:
   - Open your database page
   - Click "..." menu → "Add connections"
   - Select your integration

#### 7.3 Configure PromptDock

```bash
# Run setup wizard
prompt notion setup

# You'll be asked for:
? Notion Integration Token: secret_abc123... (paste your token)
? Notion Database ID: a1b2c3d4e5f6... (paste your database ID)
```

#### 7.4 Sync Your Prompts

```bash
# Sync all prompts to Notion
prompt notion sync

# Check connection status
prompt notion status
```

Your Notion database will now contain:
- Prompt name, namespace, and folder
- Version and author information
- Tags and descriptions
- Full prompt content
- Last sync date

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

## FAQ

### How is this different from just copying files?

**Without PromptDock:**
- Manually copy files between projects
- Update 7 different files when prompts change
- No version control or organization
- Each project has different, outdated prompts

**With PromptDock:**
- Central repository with version control
- Auto-generates all provider formats
- Pull updates with one command
- Organized by namespace and project needs

### Do I need to create a prompt repository first?

Yes, for global mode. You need a git repository with your prompts organized in folders. See [Part A](#part-a-create-your-prompt-repository-one-time-setup) of the workflow.

For project mode, you can pull from any existing prompt repository (your team's, open source, etc.).

### Can I use multiple prompt repositories?

Yes! Each prompt source in your `prompt.json` can point to a different repository:

```json
{
  "prompts": [
    {
      "repo": "https://github.com/company/internal-prompts.git",
      "namespace": "web/react"
    },
    {
      "repo": "https://github.com/community/open-prompts.git", 
      "namespace": "testing/jest"
    }
  ]
}
```

### What happens to my existing `.cursorrules` or `CLAUDE.md`?

PromptDock overwrites these files when you run `prompt pull`. Back them up first if needed.

### Can I customize which providers get which prompts?

Yes! Each prompt configuration can specify different providers:

```json
{
  "name": "frontend-only",
  "providers": {
    "cursor": { "enabled": true },
    "claude": { "enabled": false }
  }
}
```

## Contributing

Found a bug or want to add a provider? PRs welcome!

## License

ISC License

---
Made by [Stefano Amorelli](https://amorelli.tech)