# Global agent instructions

## Matt Pocock skills routing

When `mattpocock/skills` is installed, proactively use these skills for day-to-day engineering workflow.

### Repo setup

- Before first use in a repo, suggest or run `/skill:setup-matt-pocock-skills` if the repo lacks `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`, or an `## Agent skills` block in its existing `CLAUDE.md`/`AGENTS.md`.
- The setup skill edits `CLAUDE.md` if it exists, else `AGENTS.md`; do not create the other file just for setup.
- For new feature development or side-project development, run setup first unless user explicitly skips it.
- Prefer local markdown tickets for small side projects unless user says GitHub/GitLab/Jira/Linear is used.

### Skill routing

- Use `/skill:ask-matt` when unsure which Matt skill or workflow fits.
- Use `/skill:grill-with-docs` when user asks for feature planning, requirements discovery, vague product idea, domain modeling, or big change; it wraps `/skill:grilling` plus `/skill:domain-modeling`.
- Use `/skill:domain-modeling` when user wants domain terms, glossary, ubiquitous language, or ADR/domain-doc updates.
- Use `/skill:wayfinder` for huge or foggy work that cannot fit in one agent session and needs an issue-tracker map.
- Use `/skill:to-spec` when user asks to turn conversation/context into a spec/PRD.
- Use `/skill:to-tickets` when user asks to turn a plan/spec into tracer-bullet tickets or vertical slices.
- Use `/skill:implement` when user asks to implement an approved spec or ticket set.
- Use `/skill:tdd` when user asks to implement behavior or fix bug and tests are possible.
- Use `/skill:diagnosing-bugs` when bug cause is unclear, test failure is mysterious, behavior differs across environments, performance regressed, or previous fix failed.
- Use `/skill:codebase-design` when code area is unfamiliar, architecture unclear, or user asks where/how something fits.
- Use `/skill:improve-codebase-architecture` when code feels tangled, duplicated, hard to change, or user asks for refactor/architecture review.
- Use `/skill:code-review` when user asks to review a branch, PR, WIP changes, or changes since a fixed point.
- Use `/skill:triage` when user asks to process issue backlog, external PRs, or classify issues.
- Use `/skill:prototype` when user wants throwaway exploration, UI alternatives, or business-logic/state-machine experiments.

### Operating rules

- Prefer explicit skill use at workflow boundaries instead of always-on process.
- Do not run heavyweight skills for trivial edits.
- If unsure whether to use a skill, briefly say which skill fits and ask for confirmation, or use `/skill:ask-matt`.
- When adopting skills in new side projects, start with setup, then grill-with-docs/domain-modeling, then to-spec or to-tickets, then implement/tdd.
- Work the frontier one ticket at a time with `/skill:implement`, clearing context between tickets.
- Use `/todos` for long-session work where agent does big chunk first, then user reviews later.
- Use `/todos` for from-scratch spec or new-project implementation work.
- Use `pi-subagents` for big-scope tasks: spec implementation from scratch, large refactors, broad codebase investigation, architecture changes, multi-file feature work, or review-heavy work.
- For big-scope implementation, prefer this flow: clarify → `/todos` → `planner` subagent → `worker` subagent → fresh `reviewer` subagent(s) → apply fixes that matter.
- Use `scout` before planning when code area is unfamiliar; use `researcher` when external docs/current facts matter; use `oracle` when plan/decision is risky.
- Run parallel reviewers for substantial diffs, with separate angles such as correctness, tests, and unnecessary complexity.
- Skip `/todos` and subagents for small incremental edits, quick bug fixes, or one-off changes.

### Subagent spawn policy

- Spawn subagents at **medium** thinking effort by default.
- **Always confirm before spawning.** Never spawn a subagent without asking first, even a single routine one. State the agent type, its task in one line, and the effort level, then wait for a go.
- Never raise a subagent above medium effort on your own judgement. If a task looks like it needs high or max effort, say which agent, which task, and why medium is insufficient — then wait.
- Batch the ask: when a plan needs several subagents, list all of them in one confirmation rather than asking per agent.
- This gates spawning, not thinking. The orchestrator's own reasoning effort is unaffected.

## Lazy senior dev mode (ponytail)

When writing or reviewing code, follow https://github.com/DietrichGebert/ponytail. Sole authority on how much to build.

Ladder before coding: need it? → stdlib? → native? → installed dep? → one line? → minimum code. No unrequested abstractions, deps, or boilerplate. Mark shortcuts with `ponytail:` comments naming the ceiling + upgrade path.

Carve-outs (NEVER lazy): trust-boundary validation, data-loss handling, security, accessibility, hardware calibration.

Verification rule: non-trivial logic leaves ONE runnable check behind (assert demo or one small test file, no frameworks).

Commands available: `/ponytail [lite|full|ultra|off]`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`.
