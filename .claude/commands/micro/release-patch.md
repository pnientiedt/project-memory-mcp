# Release Patch Version

Release a new patch version (e.g., 0.1.0 -> 0.1.1).

## Steps

1. **Verify clean working directory**
   ```bash
   git status --porcelain
   ```
   If there are uncommitted changes, stop and ask user to commit or stash them first.

2. **Run tests**
   ```bash
   go test ./...
   ```
   If tests fail, stop and report the failures.

3. **Determine new version**
   ```bash
   # Get current version from latest tag
   CURRENT=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "0.0.0")
   # Calculate new patch version
   MAJOR=$(echo $CURRENT | cut -d. -f1)
   MINOR=$(echo $CURRENT | cut -d. -f2)
   PATCH=$(echo $CURRENT | cut -d. -f3)
   NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
   ```
   Show the user: "Releasing v{CURRENT} -> v{NEW_VERSION}"

4. **Create and push git tag**
   ```bash
   git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
   git push origin "v${NEW_VERSION}"
   git push
   ```

5. **Report success**
   Tell the user:
   - New version: v{NEW_VERSION}
   - GitHub Actions will now build and deploy automatically
   - Landing page: https://strebcli.dev/
   - They can monitor the pipeline at https://github.com/adesso-ai/strebcli/actions
