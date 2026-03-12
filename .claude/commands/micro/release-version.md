# Release Version

Release a new version with specified bump type.

**Usage:** `/release-version [patch|minor|major]`

**Argument:** $ARGUMENTS (the bump type: patch, minor, or major)

## Steps

1. **Parse bump type from arguments**
   The argument should be one of: `patch`, `minor`, or `major`
   - If no argument provided or invalid, ask the user which bump type they want
   - patch: 0.1.0 -> 0.1.1
   - minor: 0.1.0 -> 0.2.0
   - major: 0.1.0 -> 1.0.0

2. **Verify clean working directory**
   ```bash
   git status --porcelain
   ```
   If there are uncommitted changes, stop and ask user to commit or stash them first.

3. **Ensure we're on main branch**
   ```bash
   git branch --show-current
   ```
   If not on main, warn the user and ask if they want to continue.

4. **Pull latest changes**
   ```bash
   git pull --rebase
   ```

5. **Run tests**
   ```bash
   go test ./...
   ```
   If tests fail, stop and report the failures.

6. **Run linter**
   ```bash
   golangci-lint run
   ```
   If linting fails, report warnings but allow continuing.

7. **Determine new version**
   ```bash
   # Get current version from latest tag
   CURRENT=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "0.0.0")
   MAJOR=$(echo $CURRENT | cut -d. -f1)
   MINOR=$(echo $CURRENT | cut -d. -f2)
   PATCH=$(echo $CURRENT | cut -d. -f3)

   # Calculate new version based on bump type
   case $BUMP_TYPE in
     major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
     minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0" ;;
     patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
   esac
   ```
   Show the user: "Releasing v{CURRENT} -> v{NEW_VERSION} ({BUMP_TYPE} bump)"

8. **Create git tag**
   ```bash
   git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
   ```

9. **Push tag and code**
   ```bash
   git push origin "v${NEW_VERSION}"
   git push
   ```

10. **Report success**
    Tell the user:
    - New version: v{NEW_VERSION}
    - Bump type: {BUMP_TYPE}
    - GitHub Actions will now build and deploy automatically
    - Landing page: https://strebcli.dev/
    - Pipeline URL: https://github.com/adesso-ai/strebcli/actions
