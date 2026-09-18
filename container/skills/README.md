# Container skills (runtime)

Skills here are **copied recursively** into each group’s session at `data/sessions/<group>/.claude/skills/` and mounted in the agent container as `/home/node/.claude/skills/`.

Anything the WhatsApp / WeCom / Discord / local-web agent should use belongs **here**, not only under `.claude/skills/`.

## Layout

| Directory | Role |
|-----------|------|
| `bio-tools/` | Bio CLI + Python recipes; `templates/` holds runnable plot/PyMOL scripts |
| `agent-browser/` | Browser automation skill |
| `sds-gel-review/` | SDS gel image review |
| `query-*` | Database / API usage (Ensembl, UniProt, KEGG, …) |
| `blast-search/`, `pubmed-search/`, `sequence-analysis/` | Literature & sequence workflows |
| `web-search/` | General web search via the keyless You.com MCP endpoint (news, preprints, docs) |
| `bio-manuscript-*` | Community-contributed manuscript planning pipeline for idea screening, figure planning, manuscript drafting, refinement, and implementation blueprints |
| `bio-manuscript-common/` | Shared templates and helper scripts used by the manuscript pipeline skill family |

## Community Skills

Some runtime skills may be integrated from BioClaw community contributors when they prove useful in real workflows. The manuscript pipeline skill family currently staged here is integrated as a community-contributed workflow adapted from [bio-manuscript-forge](https://github.com/donghongyu2020/bio-manuscript-forge/tree/main/bio-manuscript-forge).

Contributor reference:
- Hongyu Dong, Westlake University PhD candidate, BioClaw community contributor

## Developer-only skills

Meta skills that teach **how to change the repo** (setup, add-telegram, convert-to-docker, `add-figure`, etc.) stay in **`.claude/skills/`** at the project root.
