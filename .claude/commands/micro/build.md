---
description: Build streb binary and run quality checks
allowed-tools: Bash(go:*), Bash(golangci-lint:*), Bash(goreleaser:*), Bash(ls:*), Bash(./builds/build.sh:*), Bash(git:*)
---

## Task

Build the streb project with quality checks and optional versioned release builds.

### Arguments

- `patch` - Bump patch version (0.1.0 -> 0.1.1) and build installers
- `minor` - Bump minor version (0.1.0 -> 0.2.0) and build installers
- `major` - Bump major version (0.1.0 -> 1.0.0) and build installers
- `--tag` - Also create and push a git tag (use with patch/minor/major)
- `release` or `snapshot` - Use goreleaser for cross-platform builds

### Workflow

1. **Format code**
   ```bash
   go fmt ./...
   ```

2. **Run linter**
   ```bash
   golangci-lint run
   ```

3. **Build based on arguments**

   **If $ARGUMENTS contains "patch", "minor", or "major":**

   This creates versioned macOS PKG installers and Windows executable.

   ```bash
   # Determine bump type from arguments
   # If --tag is also present, add the --tag flag
   ./builds/build.sh <bump_type> [--tag]
   ```

   Examples:
   - `patch` → `./builds/build.sh patch`
   - `minor --tag` → `./builds/build.sh minor --tag`
   - `major` → `./builds/build.sh major`

   **If $ARGUMENTS contains "release" or "snapshot":**
   ```bash
   goreleaser build --snapshot --clean
   ```

   **Otherwise (default dev build):**
   ```bash
   go build -o bin/streb ./cmd/streb
   ```

4. **Verify build**
   ```bash
   # For dev builds:
   ls -la bin/streb
   ./bin/streb --version

   # For versioned builds:
   ls -la builds/*/streb-*
   ```

5. **If --tag was used, show next steps:**
   ```
   Git tag created. To push the tag:
   git push origin v<version>
   ```

Report any errors and suggest fixes.
