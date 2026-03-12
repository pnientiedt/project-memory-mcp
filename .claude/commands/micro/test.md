---
description: Run tests with optional coverage
allowed-tools: Bash(go:*)
argument-hint: [package or -cover]
---

## Task

Run tests for streb:

1. **Run tests**
   - If no arguments: `go test ./...`
   - If package specified: `go test ./$ARGUMENTS/...`
   - If "-cover" specified: `go test -cover ./...`
   - If "-v" specified: `go test -v ./...`

2. **For coverage report**
   ```bash
   go test -coverprofile=coverage.out ./...
   go tool cover -html=coverage.out -o coverage.html
   ```

3. **Report results**
   - Total tests run
   - Any failures with details
   - Coverage percentage if requested
   - Suggestions for missing test coverage

For failing tests, show:
- Test name
- Expected vs actual
- File location
- Suggested fix
