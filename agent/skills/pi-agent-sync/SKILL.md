---
name: pi-agent-sync
description: Sync this machine's Pi agent setup to another machine over SSH. Use when user asks to sync Pi skills, agents, extensions, prompts, themes, settings, or ~/.pi/agent to another Pi instance.
---

# Pi Agent Sync

Sync global Pi agent config/resources from source machine to target machine over SSH.

## What Pi uses

Pi default config dir: `~/.pi/agent`.

Important paths:

- `AGENTS.md` — global instructions
- `settings.json` — global settings
- `models.json` — custom models/providers
- `git/` — git-installed Pi packages, skills, prompts, extensions, themes
- `skills/` — direct global skills
- `extensions/` — direct global extensions
- `prompts/` — direct global prompt templates
- `themes/` — direct global themes

Do not sync by default:

- `auth.json` — secrets/tokens
- `sessions/` — chat history
- `bin/` — machine-specific binaries

After sync, tell user to run `/reload` in target Pi or restart target Pi.

## Preflight

Use dry-run first:

```bash
~/.pi/agent/skills/pi-agent-sync/scripts/sync-pi-agent-once.sh --dry-run <ssh-target> [remote-agent-dir]
```

For target `100.116.19.90`:

```bash
~/.pi/agent/skills/pi-agent-sync/scripts/sync-pi-agent-once.sh --dry-run 100.116.19.90
```

If SSH user differs:

```bash
~/.pi/agent/skills/pi-agent-sync/scripts/sync-pi-agent-once.sh --dry-run sesar@100.116.19.90
```

If SSH fails with `Connection refused`, target SSH server is not listening/reachable. User must enable SSH on target, start sshd, or use correct Tailscale device/IP.

## Real sync

Run without `--dry-run`:

```bash
~/.pi/agent/skills/pi-agent-sync/scripts/sync-pi-agent-once.sh <ssh-target> [remote-agent-dir]
```

Default remote dir: `~/.pi/agent`.

## Safety rules

- Never copy `auth.json` unless user explicitly asks and acknowledges token risk.
- Never delete remote `sessions/`, `auth.json`, or `bin/`.
- Use `--dry-run` before real sync when target has not been tested in current conversation.
- If target is Windows OpenSSH but Pi runs inside WSL, remote path may need WSL SSH target, not Windows host.
