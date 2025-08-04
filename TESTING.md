# Testing PromptDock

## Quick Test

The fastest way to test PromptDock:

```bash
# Clone and build
git clone https://github.com/stefanoamorelli/promptdock.git
cd promptdock
pnpm install && pnpm build

# Run the test script
./test-script.sh
```

This will:
1. Create a test project with sample prompts
2. Pull prompts from the included test repository
3. Generate all provider configuration files
4. Show you the results

## Manual Testing

### 1. Create Test Project

```bash
mkdir my-test-project
cd my-test-project

# Initialize with the wizard
node /path/to/promptdock/dist/index.js init
```

Follow the prompts to configure:
- AI providers (select Claude, Cursor, Gemini)
- Prompt sources (use the test repo)
- Folder structure

### 2. Test Pull

```bash
# Pull all configured prompts
node /path/to/promptdock/dist/index.js pull --all
```

### 3. Verify Results

Check that files were created:
```bash
ls -la .claude/     # Should have instructions.md, commands.md
ls -la .cursor/     # Should have .cursorrules
ls -la .gemini/     # Should have instructions.md
```

## Test Repository Structure

The included `test-repo/` contains:

```
test-repo/
├── web/frontend/
│   ├── component-standards.md
│   └── styling-guide.md
└── backend/node/
    ├── api-patterns.md
    └── database-conventions.md
```

This simulates a real prompt repository with namespaces.

## Provider Testing

Each provider should generate the correct format:

| Provider | Expected File | Format |
|----------|---------------|---------|
| Claude | `.claude/instructions.md` | Markdown with sections |
| Cursor | `.cursor/.cursorrules` | Plain text rules |
| Gemini | `.gemini/instructions.md` | Markdown + CLI examples |
| Copilot | `.github/copilot-instructions.md` | Markdown |
| Aider | `.aider/conventions.md` | Markdown conventions |

## Testing Notion Integration

1. Set up a test Notion database
2. Run `prompt notion setup`
3. Enter test credentials
4. Run `prompt notion sync`
5. Check that prompts appear in your Notion database

## Development Testing

While developing:

```bash
# Build and test in one command
pnpm build && ./test-script.sh

# Test specific command
pnpm build && node dist/index.js pull --help

# Clean test
rm -rf test-output && ./test-script.sh
```

## Common Issues

**"No configuration found"**
- Make sure you ran `prompt init` first

**"Failed to clone repository"** 
- Check the repository URL in your `prompt.json`
- Make sure the namespace exists in the repo

**"No prompt files found"**
- Check that the namespace path has `.md` files
- Verify the repository structure matches your config