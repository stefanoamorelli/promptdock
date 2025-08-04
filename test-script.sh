#!/bin/bash

# PromptDock Test Script
# This script demonstrates the complete workflow of PromptDock

set -e

echo "🧪 PromptDock Testing Script"
echo "=============================="

# Build the project
echo "📦 Building PromptDock..."
pnpm build

# Create test directory
TEST_DIR="./test-output"
rm -rf $TEST_DIR
mkdir -p $TEST_DIR
cd $TEST_DIR

echo "📍 Testing in directory: $(pwd)"

# Get absolute path to the test repo
TEST_REPO_PATH="$(cd ../test-repo && pwd)"
echo "📂 Test repository: $TEST_REPO_PATH"

# Create a sample prompt.json for testing
echo "📝 Creating test prompt.json..."
cat > prompt.json << EOF
{
  "name": "test-web-project",
  "description": "Testing PromptDock multi-provider setup",
  "prompts": [
    {
      "name": "frontend-standards",
      "description": "React and TypeScript standards",
      "repo": "$TEST_REPO_PATH",
      "namespace": "web/frontend",
      "folders": ["components", "styling", "best-practices"],
      "providers": {
        "claude": { "enabled": true, "includeCommands": true },
        "cursor": { "enabled": true },
        "copilot": { "enabled": true },
        "gemini": { "enabled": true }
      }
    },
    {
      "name": "backend-patterns",
      "description": "Node.js backend patterns",
      "repo": "$TEST_REPO_PATH",
      "namespace": "backend/node",
      "folders": ["api", "database", "security"],
      "providers": {
        "claude": { "enabled": true, "includeCommands": false },
        "cursor": { "enabled": true },
        "aider": { "enabled": true }
      }
    }
  ],
  "providers": {
    "claude": {
      "folder": ".claude",
      "includeCommands": true
    },
    "cursor": {
      "folder": ".cursor",
      "filename": ".cursorrules"
    },
    "copilot": {
      "folder": ".github",
      "filename": "copilot-instructions.md"
    },
    "gemini": {
      "folder": ".gemini",
      "filename": "instructions.md"
    },
    "aider": {
      "folder": ".aider",
      "filename": "conventions.md"
    }
  },
  "gitignore": [
    ".claude",
    ".cursor", 
    ".github/copilot-instructions.md",
    ".gemini",
    ".aider",
    ".promptdock/",
    "frontend-standards/",
    "backend-patterns/"
  ]
}
EOF

echo "✅ Created prompt.json with test configuration"

# Test the pull command
echo "🚀 Testing prompt pull --all..."
node ../dist/index.js pull --all

echo ""
echo "📋 Test Results:"
echo "================"

# Check if folders were created
echo "📁 Created folders:"
ls -la | grep "^d" | grep -v "^\.$" | grep -v "^\.\.$"

echo ""
echo "🤖 Provider configurations:"

# Check each provider
for provider in ".claude" ".cursor" ".github" ".gemini" ".aider"; do
  if [ -d "$provider" ]; then
    echo "✅ $provider:"
    ls -la "$provider/"
  else
    echo "❌ $provider: Not found"
  fi
done

echo ""
echo "📄 Sample file contents:"

if [ -f ".claude/instructions.md" ]; then
  echo "--- Claude Instructions (first 10 lines) ---"
  head -10 .claude/instructions.md
fi

if [ -f ".cursor/.cursorrules" ]; then
  echo "--- Cursor Rules (first 5 lines) ---"
  head -5 .cursor/.cursorrules
fi

echo ""
echo "🎉 Test completed!"
echo "Check the files in: $TEST_DIR"

cd ..