---
description: Merge develop to main and deploy to Netlify
allowed-tools: Bash(git:*)
---

## Task

Merge the develop branch into main, which triggers automatic deployment to Netlify.

### Prerequisites

Before running this command:
1. Ensure you have built and tested the latest changes
2. Ensure all changes are committed on develop

### Workflow

1. **Check current branch and status**
   ```bash
   git status
   git branch
   ```

2. **Ensure working directory is clean**
   If there are uncommitted changes, warn the user and stop.

3. **Switch to main branch**
   ```bash
   git checkout main
   ```

4. **Pull latest changes**
   ```bash
   git pull --rebase
   ```

5. **Merge develop into main**
   ```bash
   git merge develop -m "Merge develop: deploy release"
   ```

6. **Push to trigger Netlify deploy**
   ```bash
   git push
   ```

   Netlify automatically deploys the website when changes are pushed to main.

7. **Return to develop branch**
   ```bash
   git checkout develop
   ```

8. **Report result**
   - Show the deployed version
   - Show the website URL: https://strebcli.dev/

### Error Handling

- If merge fails due to conflicts, abort and return to develop
- If push fails, show the error and help user resolve
