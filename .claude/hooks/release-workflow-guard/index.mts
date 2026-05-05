#!/usr/bin/env node
// Claude Code PreToolUse hook — release-workflow-guard.
//
// BLOCKS every Bash command that would dispatch a GitHub Actions
// workflow. The user runs workflow_dispatch jobs manually after
// reviewing the release commit and waiting for CI to pass —
// auto-triggering is irrevocable in the short term:
//
//   - Publish workflows push npm versions (unpublishable after 24h).
//   - Build/Release workflows publish GitHub releases pinned by SHA.
//   - Container workflows push immutable image tags.
//
// Even nominally-CI workflow_dispatches often carry prod side
// effects (the socket-btm binary builders gate prod releases on a
// `dry_run` input, but the dispatch itself is the trigger). The
// safe default is "block all dispatches and ask the user to run
// them themselves." Cost of an extra block: one re-prompt. Cost
// of a missed prod publish: irreversible.
//
// Exit code 2 with a clear stderr message stops the tool call. The
// model never gets to fire the command. The user re-runs it from
// their own terminal (or via the GitHub Actions UI) when ready.
//
// Blocked patterns:
//   - `gh workflow run <id>`
//   - `gh workflow dispatch <id>` (alias of `run`)
//   - `gh api ... actions/workflows/<id>/dispatches` POST/PUT
//
// This hook is the enforcement layer paired with the CLAUDE.md
// rule. The rule documents the policy; the hook makes it
// mechanical so the model can't accidentally dispatch a workflow
// even when reasoning about urgent release work.
//
// Reads a Claude Code PreToolUse JSON payload from stdin:
//   { "tool_name": "Bash", "tool_input": { "command": "..." } }

import { readFileSync } from 'node:fs'
import process from 'node:process'

type ToolInput = {
  tool_name?: string
  tool_input?: {
    command?: string
  }
}

// `gh workflow run <id-or-file>` / `gh workflow dispatch <id-or-file>`.
// The captured workflow argument is reported back so the user can
// see what was blocked.
const GH_WORKFLOW_DISPATCH_RE =
  /\bgh\s+workflow\s+(?:run|dispatch)\b(?:\s+(?:--repo|--ref|-f|--field)\s+\S+)*\s+(['"]?)([^\s'"]+)\1/g

// `gh api .../actions/workflows/<id>/dispatches` (POST/PUT).
// The path component implies dispatch — no need to also match -X.
const GH_API_WORKFLOW_DISPATCH_RE =
  /\bgh\s+api\b[^|]*?\/actions\/workflows\/([^/\s]+)\/dispatches\b/g

// Walk the command and return a per-position boolean: true means the
// char at index i sits inside a single- or double-quoted string. We
// use this to skip matches that fall inside `git commit -m "..."`
// message bodies, heredocs, etc. — text that the shell will pass as
// a literal argument value, not execute. Without this, mentioning
// `gh workflow run` inside a commit message body trips the hook.
//
// Limitations: this is not a full POSIX shell parser. Heredocs
// (<<EOF ... EOF) read as code-mode here, but in practice commit
// messages via heredoc are quoted by `$(cat <<'EOF' ... EOF)` and
// the outer `$(...)`/`"..."` wrap puts the body in quoted-mode.
// `\$` and other escapes inside quotes are honored only in the
// limited sense of skipping the next char.
function buildQuoteMask(s: string): boolean[] {
  const mask = new Array<boolean>(s.length).fill(false)
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i]
    if (!inSingle && !inDouble && c === "'") {
      inSingle = true
      mask[i] = true
      continue
    }
    if (inSingle && c === "'") {
      inSingle = false
      mask[i] = true
      continue
    }
    if (!inSingle && !inDouble && c === '"') {
      inDouble = true
      mask[i] = true
      continue
    }
    if (inDouble && c === '"') {
      inDouble = false
      mask[i] = true
      continue
    }
    if (inDouble && c === '\\' && i + 1 < s.length) {
      mask[i] = true
      mask[i + 1] = true
      i += 1
      continue
    }
    mask[i] = inSingle || inDouble
  }
  return mask
}

function detectDispatch(command: string): {
  blocked: boolean
  workflow?: string
  shape?: string
} {
  // We can't `replace(/\s+/g, ' ')` first because that would offset
  // the quote mask from the original string. Match against the raw
  // command and use the mask to filter false-positives.
  const mask = buildQuoteMask(command)

  // The /g-flag regex is a module-scoped singleton; `.exec()` advances
  // `lastIndex` and only resets when it returns null at end-of-input.
  // If our previous call broke out of the loop early (because we found
  // a quote-masked match), `lastIndex` is left mid-string and the next
  // `detectDispatch` call would resume from there instead of scanning
  // the whole command. Reset before each scan to make the regex
  // stateless from the caller's perspective.
  GH_WORKFLOW_DISPATCH_RE.lastIndex = 0
  let cliMatch: RegExpExecArray | null
  while ((cliMatch = GH_WORKFLOW_DISPATCH_RE.exec(command))) {
    if (!mask[cliMatch.index]) {
      return {
        blocked: true,
        workflow: cliMatch[2],
        shape: 'gh workflow run/dispatch',
      }
    }
  }

  // Same /g-flag reset rationale as above — keep the regex stateless
  // across calls.
  GH_API_WORKFLOW_DISPATCH_RE.lastIndex = 0
  let apiMatch: RegExpExecArray | null
  while ((apiMatch = GH_API_WORKFLOW_DISPATCH_RE.exec(command))) {
    if (!mask[apiMatch.index]) {
      return {
        blocked: true,
        workflow: apiMatch[1],
        shape: 'gh api .../dispatches',
      }
    }
  }

  return { blocked: false }
}

function main(): void {
  let raw = ''
  try {
    raw = readFileSync(0, 'utf8')
  } catch {
    return
  }

  let input: ToolInput
  try {
    input = JSON.parse(raw)
  } catch {
    return
  }

  if (input.tool_name !== 'Bash') {
    return
  }
  const command = input.tool_input?.command
  if (!command || typeof command !== 'string') {
    return
  }

  const { blocked, workflow, shape } = detectDispatch(command)
  if (!blocked) {
    return
  }

  const lines = [
    '[release-workflow-guard] BLOCKED: this command would dispatch a',
    `  GitHub Actions workflow (${shape}, target: ${workflow ?? '<unknown>'}).`,
    '',
    '  Workflow dispatches often have irreversible prod side effects:',
    '    - Publish workflows push npm versions (unpublishable after 24h).',
    '    - Build/Release workflows create GitHub releases pinned by SHA.',
    '    - Container workflows push immutable image tags.',
    "    - Even build workflows with a 'dry_run' input still treat the",
    '      dispatch itself as the prod trigger.',
    '',
    '  The user runs workflow_dispatch jobs manually — never Claude.',
    '  Tell the user to run the command in their own terminal (or',
    '  via the GitHub Actions UI), then resume.',
    '',
    '  This hook has no opt-out. If you genuinely need to run a',
    '  benign dispatch (e.g. a debug-only utility workflow), ask',
    "  the user to invoke it themselves; don't seek a bypass here.",
  ]
  process.stderr.write(lines.join('\n') + '\n')
  process.exitCode = 2
}

main()
