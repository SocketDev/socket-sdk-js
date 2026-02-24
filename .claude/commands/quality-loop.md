Run the quality-scan skill and fix all issues found. Repeat until zero issues remain or 5 iterations complete.

## Process

1. Run quality-scan skill
2. If issues found: fix ALL of them
3. Run quality-scan again
4. Repeat until:
   - Zero issues found (success), OR
   - 5 iterations completed (stop)
5. Commit all fixes with message: "fix: resolve quality scan issues (iteration N)"

## Rules

- Fix every issue, not just "easy" ones
- Do not skip architectural fixes
- Run tests after fixes to verify nothing broke
- Track iteration count and report progress
