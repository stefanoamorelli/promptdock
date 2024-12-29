# Get Prompt Action

GitHub Action to fetch prompts from a promptdock repository with version support.

## Usage

```yaml
steps:
  - name: Get prompt
    uses: stefanoamorelli/promptdock/.github/actions/get-prompt@v1
    with:
      prompt: convert-ai-mirage@1.0.0
      repository: stefanoamorelli/prompts-repository

  - name: Use prompt
    run: echo "${{ steps.get-prompt.outputs.prompt }}"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `prompt` | Prompt to fetch (format: `name@version`, `namespace/name@version`, or `name@latest`) | Yes | |
| `repository` | GitHub repository containing prompts (format: `owner/repo`) | Yes | |
| `token` | GitHub token for repository access | No | `${{ github.token }}` |

## Outputs

| Output | Description |
|--------|-------------|
| `prompt` | The prompt content (without YAML frontmatter) |
| `name` | Prompt name |
| `namespace` | Prompt namespace |
| `version` | Prompt version |
| `author` | Prompt author |
| `description` | Prompt description |
| `tags` | Prompt tags (JSON array) |
| `created` | Prompt creation date |

## Examples

### Get specific version
```yaml
- name: Get prompt
  uses: stefanoamorelli/promptdock/.github/actions/get-prompt@v1
  with:
    prompt: convert-ai-mirage@1.0.0
    repository: stefanoamorelli/prompts-repository
```

### Get latest version
```yaml
- name: Get prompt
  uses: stefanoamorelli/promptdock/.github/actions/get-prompt@v1
  with:
    prompt: convert-ai-mirage@latest
    repository: stefanoamorelli/prompts-repository
```

### Get from specific namespace
```yaml
- name: Get prompt
  uses: stefanoamorelli/promptdock/.github/actions/get-prompt@v1
  with:
    prompt: web/api-converter@2.1.0
    repository: stefanoamorelli/prompts-repository
```

### Use with Claude Code Action
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get prompt
        id: get_prompt
        uses: stefanoamorelli/promptdock/.github/actions/get-prompt@v1
        with:
          prompt: convert-ai-mirage@1.0.0
          repository: stefanoamorelli/prompts-repository

      - name: Run Claude Code with limited turns
        uses: anthropics/claude-code-base-action@beta
        with:
          prompt: ${{ steps.get_prompt.outputs.prompt }}
```

## Prompt Format

Prompts should be stored as Markdown files with YAML frontmatter:

```markdown
---
name: convert-ai-mirage
namespace: web
version: 1.0.0
author: Stefano Amorelli
description: This converts OpenAPI → MirageJS mocks.
created: 2025-01-06
tags: ["ai", "openapi", "conversion"]
---

Your prompt content goes here...
```

## Repository Structure

```
prompts-repository/
├── web/
│   ├── convert-ai-mirage.md
│   └── api-converter.md
├── be/
│   └── database-rules.md
└── mobile/
    └── flutter-context.md
```