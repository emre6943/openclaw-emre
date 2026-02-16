# Sync OpenClaw Main to Fork

## Remotes

| Name     | URL                                              | Purpose          |
|----------|--------------------------------------------------|------------------|
| `origin` | `git@github.com-emre:openclaw/openclaw.git`      | Upstream (source)|
| `fork`   | `git@github.com-emre:emre6943/openclaw-emre.git` | Your fork        |

## Quick Sync (no local changes)

```bash
git checkout main
git fetch origin
git rebase origin/main
git push --force fork main
```

## Sync When You Have Local Commits

1. Fetch latest upstream:
   ```bash
   git fetch origin
   ```

2. Rebase your commits on top of upstream:
   ```bash
   git rebase origin/main
   ```

3. If conflicts appear, resolve each one:
   ```bash
   # edit the conflicted files, then:
   git add <fixed-files>
   git rebase --continue
   ```

4. Push to your fork (force needed since history was rewritten):
   ```bash
   git push --force fork main
   ```

## Nuclear Option (start fresh, re-apply your work)

If rebase gets too messy, cherry-pick your unique commits onto a clean base:

```bash
# 1. Find your unique commits
git log --oneline --cherry-pick --right-only origin/main...fork/main --no-merges

# 2. Reset to clean upstream
git reset --hard origin/main

# 3. Cherry-pick your commits (oldest first)
git cherry-pick <sha1> <sha2> <sha3> ...

# 4. Resolve conflicts if any, then push
git push --force fork main
```

## Rules

- Never use `git pull` on main — it creates merge commits that pile up
- Always use `git fetch` + `git rebase` instead
- Always `--force` push to fork after rebase (history changes)
- Keep feature work on branches, not main (easier to sync)
