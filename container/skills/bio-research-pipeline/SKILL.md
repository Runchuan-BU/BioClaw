---
name: bio-research-pipeline
description: >
  Biological hypothesis generation pipeline. Given a broad research direction,
  runs parallel literature searches (PubMed + preprints + pathway DBs), generates
  ≥5 mechanistic hypotheses, conducts multi-agent debate to select top 3, then
  designs wet-lab experimental plans for each. Outputs a structured research brief.
keywords:
  - bio-research-pipeline
  - hypothesis-generation
  - literature-review
  - experimental-design
  - wet-lab
  - multi-agent-debate
  - pathway-analysis
---

# Biological Research Hypothesis Pipeline

You are a research coordinator orchestrating a multi-stage biological research pipeline.
This skill is triggered when a user provides a broad biological research direction and wants:
- A thorough literature review
- Multiple mechanistic hypotheses
- Multi-perspective critique and ranking
- Wet-lab experimental designs

---

## SCRIPT PATH RESOLUTION

This skill includes three helper scripts. Before running them, locate them:

```bash
SKILL_DIR=$(find ~/.claude/skills -name "SKILL.md" -path "*/bio-research-pipeline/*" | xargs dirname 2>/dev/null | head -1)
PUBMED_SCRIPT="$SKILL_DIR/scripts/pubmed-fetch"
PREPRINT_SCRIPT="$SKILL_DIR/scripts/preprint-fetch"
PATHWAY_SCRIPT="$SKILL_DIR/scripts/pathway-search"
echo "Skill dir: $SKILL_DIR"
ls "$SKILL_DIR/scripts/"
```

Then invoke scripts as:
```bash
python3 "$PUBMED_SCRIPT" "your topic" --max 40 --years 5
python3 "$PREPRINT_SCRIPT" "your topic" --max 30 --days 180
python3 "$PATHWAY_SCRIPT" "your topic" --gene GENE_SYMBOL
```

---

## HOW TO INVOKE THIS PIPELINE

When a user asks something like:
- "帮我研究一下 [方向]"
- "我想研究 [X] 机制，帮我提假说"
- "针对 [疾病/通路/基因]，设计一个研究方向"
- "run bio-research-pipeline on [topic]"

Parse the research direction from the user's message, then execute all 5 stages below **in order**.

---

## STAGE 1 — PARALLEL LITERATURE SEARCH (3 MODELS)

**Goal:** Cast a wide net using three models simultaneously — each with a different strength.

| Role | Model | Responsibility |
|------|-------|---------------|
| Task A | **Claude** (you) | Real data fetch — PubMed API + bioRxiv API, runs Python scripts |
| Task B | **MiniMax** | Biomedical knowledge analysis, Chinese literature context, cross-checking |
| Task C | **Qwen** | Pathway landscape mapping, fast synthesis, regulatory network overview |

Use the `Task` tool to launch **all 3 tasks in the same message** (parallel). Do NOT wait for one before starting the next.

---

### Task A — Claude: Real Literature Fetch (PubMed + Preprints)

This task runs actual API calls using the helper scripts in this skill.

Prompt for Task A:
```
You are doing a real literature fetch for the bio-research-pipeline.
Research direction: {RESEARCH_DIRECTION}

Step 1 — Locate skill scripts:
SKILL_DIR=$(find ~/.claude/skills -name "SKILL.md" -path "*/bio-research-pipeline/*" | xargs dirname 2>/dev/null | head -1)

Step 2 — Run PubMed fetch:
python3 "$SKILL_DIR/scripts/pubmed-fetch" "{RESEARCH_DIRECTION}" --max 40 --years 5

Step 3 — Run preprint fetch:
python3 "$SKILL_DIR/scripts/preprint-fetch" "{RESEARCH_DIRECTION}" --max 25 --days 180

Step 4 — Synthesize into structured summary:
- Key molecular mechanisms found
- Key proteins/genes/pathways mentioned
- Most significant recent findings (2023-2025)
- Any contradictions or open debates
- Top 5 most relevant papers with PMID/DOI

Output all results clearly labeled with section headers.
```

---

### Task B — MiniMax: Biomedical Knowledge Analysis

This task calls MiniMax via `mcp__bioclaw__call_minimax`. MiniMax contributes its own training knowledge — particularly strong on Chinese biomedical literature, clinical context, and TCM-related pathways.

Prompt for Task B:
```
Call mcp__bioclaw__call_minimax with this prompt:

system: "You are an expert biomedical research analyst with deep knowledge of molecular biology, disease mechanisms, and the latest research trends in both Western and Chinese scientific literature."

prompt: "Research direction: {RESEARCH_DIRECTION}

Please provide a comprehensive analysis covering:

1. CURRENT STATE OF THE FIELD
   - What is well-established about this topic?
   - What are the 3-5 most important mechanistic insights from recent years?
   - Which research groups/labs are leading this field?

2. KEY MOLECULAR PLAYERS
   - List the most important proteins, genes, and non-coding RNAs involved
   - Describe their known roles and interactions
   - Note any recently discovered players (2022-2025)

3. DISEASE RELEVANCE
   - Which diseases/conditions is this most relevant to?
   - What is the current clinical/translational status?
   - Any recent clinical trials or translational breakthroughs?

4. KNOWLEDGE GAPS
   - What are the most important unresolved questions?
   - Where do different research groups disagree?
   - What has been tried but failed, and why?

5. EMERGING ANGLES
   - What novel angles are researchers starting to explore?
   - Any recent paradigm shifts in thinking about this topic?

Provide specific, concrete information. Cite field knowledge accurately."

After getting MiniMax's response, output it verbatim with the header: "=== MINIMAX ANALYSIS ==="
```

---

### Task C — Qwen: Pathway Landscape + Regulatory Network

This task calls Qwen via `mcp__bioclaw__call_qwen` AND runs the pathway-search script for real database data.

Prompt for Task C:
```
You are mapping the pathway landscape for the bio-research-pipeline.
Research direction: {RESEARCH_DIRECTION}

Step 1 — Run real pathway database search:
SKILL_DIR=$(find ~/.claude/skills -name "SKILL.md" -path "*/bio-research-pipeline/*" | xargs dirname 2>/dev/null | head -1)
python3 "$SKILL_DIR/scripts/pathway-search" "{RESEARCH_DIRECTION}"

Step 2 — Call Qwen for pathway synthesis:
Use mcp__bioclaw__call_qwen with:

system: "You are a systems biology expert specializing in signaling pathway analysis and gene regulatory networks."

prompt: "For the research topic: {RESEARCH_DIRECTION}

Please map the complete biological pathway landscape:

1. CORE PATHWAYS INVOLVED
   - List and briefly describe each relevant pathway
   - Explain how they interconnect for this topic

2. REGULATORY HIERARCHY
   - Upstream triggers / sensors
   - Master regulators (transcription factors, kinases)
   - Key effectors and their downstream targets
   - Feedback and feedforward loops

3. CROSSTALK POINTS
   - Where do pathways intersect or antagonize each other?
   - Which nodes are shared across multiple pathways?
   - Potential compensatory mechanisms to be aware of

4. CONTEXT-SPECIFIC REGULATION
   - How does this regulation differ between cell types?
   - Tissue-specific or disease-specific pathway alterations
   - Known species differences (mouse vs human)

5. THERAPEUTIC INTERVENTION POINTS
   - Which nodes are most druggable?
   - Existing drugs/inhibitors targeting these pathways
   - Potential combination therapy rationale

Be specific about molecule names and interaction types (phosphorylation, ubiquitination, transcriptional activation, etc.)"

Output Qwen's response with header: "=== QWEN PATHWAY ANALYSIS ==="
Then append the real database results from Step 1 with header: "=== DATABASE RESULTS ==="
```

---

**After launching all 3 tasks**, collect results:
```
taskA_result = TaskOutput(task_id_A)
taskB_result = TaskOutput(task_id_B)
taskC_result = TaskOutput(task_id_C)
```
Wait for all 3 to complete before proceeding to Stage 2.

**Send a progress update to the user** via `mcp__bioclaw__send_message`:
```
"📚 文献检索完成（Claude + MiniMax + Qwen 三路并行）
🔬 Claude: PubMed {N} 篇 + 预印本 {M} 篇
🤖 MiniMax: 生物医学知识分析完成
⚡ Qwen: 通路图谱梳理完成
正在综合分析，生成假说..."
```

---

## STAGE 2 — PATHWAY SYNTHESIS + HYPOTHESIS GENERATION

**Goal:** Synthesize the 3 literature sources into a pathway map, then generate ≥5 mechanistic hypotheses.

### 2a. Build Pathway Map

From the 3 task outputs, extract:
- All mentioned proteins/genes → list with roles
- All mentioned pathways → list with descriptions
- Key interactions (A activates B, X inhibits Y)
- Unresolved questions explicitly mentioned in papers

### 2b. Generate ≥5 Hypotheses

For each hypothesis, output a structured block:

```
HYPOTHESIS [N]: [One-sentence title]

Mechanism:
  [2-3 sentences describing the molecular mechanism step by step]
  e.g. "We propose that [A] activates [B] under [condition X], which leads to [downstream effect Y]
       via [pathway Z]. This is supported by [evidence 1] but has not been directly tested in [context]."

Key molecular players:
  - [Gene/Protein 1]: [role]
  - [Gene/Protein 2]: [role]
  - [Pathway]: [how it's involved]

Supporting evidence:
  - [Paper/finding that supports this]
  - [Observation that is consistent with this]

Evidence gaps (why this is a hypothesis, not established fact):
  - [What has NOT been shown]
  - [Conflicting data, if any]

Novelty score (1-10): [score]
Reason: [why this is or isn't novel]

Testability score (1-10): [score]
Reason: [how difficult it would be to test with standard wet lab methods]
```

Generate hypotheses that:
- Cover **different mechanistic angles** (not just variations of the same idea)
- Range from **conservative** (well-supported, incremental) to **bold** (less evidence, high impact)
- Are **wet-lab testable** (avoid purely computational hypotheses)

---

## STAGE 3 — MULTI-AGENT DEBATE

**Goal:** Critically evaluate each hypothesis from 3 perspectives to identify the strongest ones.

For each hypothesis, conduct a structured 3-voice review. You will play each role in sequence:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEBATE — HYPOTHESIS [N]: [title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 SUPPORTER (argues FOR this hypothesis):
  Strongest evidence points:
    - [evidence 1]
    - [evidence 2]
  Why this mechanism is biologically plausible:
    - [mechanistic reasoning]
  Potential impact if confirmed:
    - [scientific/clinical significance]

🔴 SKEPTIC (argues AGAINST / identifies weaknesses):
  Critical weaknesses:
    - [flaw 1: e.g., "The key evidence comes from in vitro studies only"]
    - [flaw 2: e.g., "Alternative explanation: this effect may be due to [X] instead"]
  Confounding factors not accounted for:
    - [confounder]
  Prior work that challenges this:
    - [conflicting evidence or null results]

🔵 METHODOLOGIST (evaluates experimental feasibility):
  To directly test this hypothesis, you would need:
    - [key experiment]
  Technical challenges:
    - [challenge 1]
    - [challenge 2]
  Timeline estimate: [weeks/months]
  Whether a typical university wet lab can do this: [Yes/No/Partially]
  Model system recommendation: [cell line / mouse model / organoid / etc.]

DEBATE VERDICT:
  Evidence score (1-10):     [score]  — How well-supported is it currently?
  Novelty score (1-10):      [score]  — How new is this idea?
  Feasibility score (1-10):  [score]  — Can a wet lab test it in <12 months?
  Impact score (1-10):       [score]  — How significant if confirmed?

  COMPOSITE SCORE: [average, weighted: Evidence×0.3 + Novelty×0.25 + Feasibility×0.25 + Impact×0.2]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Run this for ALL hypotheses. Then rank by composite score and select **TOP 3**.

---

## STAGE 4 — TOP 3 REFINEMENT

For each of the top 3 hypotheses, expand the mechanism with full molecular detail:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOP [1/2/3]: [Hypothesis title]
Final composite score: [X.X/10]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REFINED MECHANISM:
  [4-6 sentences with full molecular detail]
  Include: upstream triggers, key effectors, downstream consequences, feedback regulation

PATHWAY DIAGRAM (text-based):
  [Stimulus/Condition]
       ↓
  [Receptor/Sensor] → activates → [Kinase/TF]
       ↓
  [Key effector]
       ↓ (promotes)        ↓ (inhibits)
  [Outcome A]           [Outcome B]

KEY UNKNOWNS to be resolved by experiments:
  1. [Unknown 1]
  2. [Unknown 2]
  3. [Unknown 3]
```

---

## STAGE 5 — WET LAB EXPERIMENTAL DESIGN

For each of the top 3 hypotheses, design a complete wet-lab experimental plan:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXPERIMENTAL PLAN — [Hypothesis title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED MODEL SYSTEM:
  Primary: [e.g., HEK293T cells / primary mouse hepatocytes / C57BL/6 mice]
  Rationale: [why this model is appropriate]
  Alternative: [backup model if primary unavailable]

EXPERIMENT 1 — [Core test of the central claim]
  Objective: [what this experiment proves or disproves]

  Method:
    1. [Step 1]
    2. [Step 2]
    3. [Step 3]

  Key reagents:
    - [Antibody/siRNA/inhibitor/construct needed]
    - [Source: commercial/need to generate]

  Readout: [what you measure — Western blot / qPCR / immunofluorescence / etc.]

  Expected result if hypothesis is TRUE:
    - [specific measurable outcome, e.g., "50%+ increase in phospho-X levels"]

  Expected result if hypothesis is FALSE:
    - [what you'd see instead]

  Controls:
    - Positive control: [what and why]
    - Negative control: [what and why]
    - Technical control: [e.g., loading control, vehicle control]

  Estimated time: [X weeks]
  Difficulty: [Easy / Medium / Hard]

EXPERIMENT 2 — [Validation / Orthogonal approach]
  [same structure as Experiment 1]

EXPERIMENT 3 — [In vivo / disease-relevance test, if applicable]
  [same structure — note if this requires animal work / ethics approval]

DECISION TREE:
  If Experiment 1 result is positive → proceed to Experiment 2
  If Experiment 1 result is negative → [interpret: reject hypothesis OR check [alternative explanation]]
  If Experiment 2 confirms → [next step: submit for funding / expand to in vivo]
  If Experiment 2 conflicts with Experiment 1 → [troubleshoot: check [specific variable]]

TIMELINE OVERVIEW:
  Week 1-2:   [setup, reagent procurement]
  Week 3-6:   [Experiment 1]
  Week 7-10:  [Experiment 2]
  Week 11-16: [Experiment 3, if applicable]
  Total estimated time to proof-of-concept: [X months]

KEY RISKS:
  - [Risk 1: e.g., "Primary antibody may not work in mouse samples"]
    Mitigation: [e.g., "Order 2 alternative antibodies from different vendors"]
  - [Risk 2: e.g., "Model system may not recapitulate in vivo physiology"]
    Mitigation: [e.g., "Validate key finding in primary cells"]
```

---

## FINAL OUTPUT FORMAT

After completing all 5 stages, produce a summary:

```
╔══════════════════════════════════════════════════════╗
║       RESEARCH BRIEF — [RESEARCH DIRECTION]          ║
║       Generated: [date]                              ║
╚══════════════════════════════════════════════════════╝

LITERATURE COVERAGE:
  PubMed papers reviewed: ~[N]
  Preprints reviewed: ~[N]
  Key pathways identified: [list]

ALL HYPOTHESES RANKED:
  #1 [score] — [title]
  #2 [score] — [title]
  #3 [score] — [title]  ← TOP 3
  #4 [score] — [title]
  #5 [score] — [title]
  [#6+ if generated]

TOP 3 RECOMMENDED FOR INVESTIGATION:
  → [Hypothesis 1 title] (strongest evidence + feasible)
  → [Hypothesis 2 title] (most novel)
  → [Hypothesis 3 title] (highest clinical impact)

NEXT STEPS:
  Immediate (0-1 month):  [first experiment to run]
  Short-term (1-6 months): [validation plan]
  Long-term (6-18 months): [expansion strategy]

FULL EXPERIMENTAL PLANS: see sections above
```

Save the complete output to `/workspace/group/research-brief-[slug].md` where [slug] is a short version of the research direction.

Tell the user: "研究简报已完成，保存在 research-brief-[slug].md。以下是摘要：" then show the summary block.

---

## IMPORTANT NOTES

- **Do not skip the debate stage** — the debate is essential to filter weak hypotheses
- **Wet lab focus** — all experimental designs must be physically executable (pipettes, cells, animals), not just computational
- **Be specific** — vague statements like "further research needed" are not acceptable; every gap should map to a specific experiment
- **Cite as you go** — whenever you make a claim, reference which paper or database it came from
- **Chinese output is fine** — if the user wrote in Chinese, respond in Chinese throughout
