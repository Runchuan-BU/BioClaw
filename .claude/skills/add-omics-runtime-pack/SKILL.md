---
name: add-omics-runtime-pack
description: Audit or refresh a curated pack of eight high-signal omics runtime skills in a BioClaw installation. Use when the user wants stronger built-in guidance for common omics analyses inside agent containers without changing BioClaw source code. Ensures the eight runtime skill folders exist under `container/skills/` with the expected flat file layout.
disable-model-invocation: true
---

# Add Omics Runtime Pack

This skill verifies that eight strong runtime skills are present under `container/skills/` for common BioClaw analysis tasks.

## What This Adds

- `container/skills/scrna-preprocessing-clustering/`
- `container/skills/cell-annotation/`
- `container/skills/chip-seq/`
- `container/skills/atac-seq/`
- `container/skills/differential-expression/`
- `container/skills/proteomics/`
- `container/skills/metagenomics/`
- `container/skills/structural-biology/`

Each runtime skill must contain only root-level files:

- `SKILL.md`
- `technical_reference.md`
- `commands_and_thresholds.md`

## What This Must Not Change

- Do not modify `src/`, `container/agent-runner/`, `Dockerfile`, or any application code.
- Do not modify `src/container-runner.ts`.
- Do not add Python packages, R packages, or other dependencies.
- Do not add nested `references/` directories under `container/skills/<skill>/`.

The contribution is delivered as runtime skill content plus this installer skill, without any source-code changes.

## Why The Runtime Skills Must Stay Flat

BioClaw syncs `container/skills/<skill>/` into `/home/node/.claude/skills/<skill>/` inside the container, but the sync only copies the first directory level.

That means:

- `container/skills/<skill>/SKILL.md` will sync
- `container/skills/<skill>/technical_reference.md` will sync
- `container/skills/<skill>/commands_and_thresholds.md` will sync
- `container/skills/<skill>/references/...` will **not** sync

So every installed runtime skill must be flat.

## Runtime Skill Source Of Truth

The runtime-ready versions now live directly in:

```text
container/skills/
```

Treat those directories as the source of truth. Do not recreate alternate copies under `.claude/skills/`.

## Implementation Steps

Run all steps directly. Only pause if one of the target runtime skill directories already exists and appears user-modified.

### 1. Verify Current State

Check:

```bash
pwd
ls -la container/skills
for skill in \
  scrna-preprocessing-clustering \
  cell-annotation \
  chip-seq \
  atac-seq \
  differential-expression \
  proteomics \
  metagenomics \
  structural-biology
do
  test -e "container/skills/$skill" && echo "$skill already exists" || echo "$skill missing"
done
```

If any target directory already exists, inspect it before changing anything.

### 2. Create Or Update The Eight Runtime Skill Directories

For each skill listed below, ensure `container/skills/<skill>/` exists and contains exactly the three required root-level files.

| Runtime skill | Required files |
|---|---|
| `scrna-preprocessing-clustering` | `SKILL.md`, `technical_reference.md`, `commands_and_thresholds.md` |
| `cell-annotation` | `SKILL.md`, `technical_reference.md`, `commands_and_thresholds.md` |
| `chip-seq` | `SKILL.md`, `technical_reference.md`, `commands_and_thresholds.md` |
| `atac-seq` | `SKILL.md`, `technical_reference.md`, `commands_and_thresholds.md` |
| `differential-expression` | `SKILL.md`, `technical_reference.md`, `commands_and_thresholds.md` |
| `proteomics` | `SKILL.md`, `technical_reference.md`, `commands_and_thresholds.md` |
| `metagenomics` | `SKILL.md`, `technical_reference.md`, `commands_and_thresholds.md` |
| `structural-biology` | `SKILL.md`, `technical_reference.md`, `commands_and_thresholds.md` |

Do not invent alternate content unless the committed runtime files clearly conflict with the current repository state.

### 3. Preserve The Runtime-Ready Shape

For every installed runtime skill:

- keep only the three root-level files above
- do not create `README.md`
- do not create nested `references/`
- keep the relative links in `SKILL.md` pointing to `technical_reference.md` and `commands_and_thresholds.md`

### 4. Validate The Installed Pack

Run these checks:

```bash
find container/skills -maxdepth 2 -type f | sort
find container/skills -maxdepth 3 -type d -name references
```

The second command should produce no output for the eight installed skills.

Also confirm that no duplicate copy of the runtime pack remains under `.claude/skills/add-omics-runtime-pack/`.

Also confirm no external-path residue remains:

```bash
grep -RniE "/Users/|omics-skills-repo-template|bioSkills-main|OpenClaw-Medical-Skills-main|claude-scientific-skills-main" \
  container/skills/scrna-preprocessing-clustering \
  container/skills/cell-annotation \
  container/skills/chip-seq \
  container/skills/atac-seq \
  container/skills/differential-expression \
  container/skills/proteomics \
  container/skills/metagenomics \
  container/skills/structural-biology
```

That search should return no matches.

### 5. Report The Result

Summarize:

- which runtime skill directories were created
- whether all eight contain exactly the three required files
- whether any pre-existing directories needed conflict resolution
- that no source files were modified
