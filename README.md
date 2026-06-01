<div align="center">
<a href="https://ivegotmagicbean.github.io/BioClaw-Page/">
<img src="bioclaw_logo.jpg" width="200">
</a>

# BioClaw

### AI-Powered Bioinformatics Research Assistant

[English](README.md) | [简体中文](README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Runchuan-BU/BioClaw)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/Runchuan-BU/BioClaw/blob/main/LICENSE)
[![Homepage](https://img.shields.io/badge/Homepage-BioClaw-blue.svg)](https://ivegotmagicbean.github.io/BioClaw-Page/)
[![Paper](https://img.shields.io/badge/bioRxiv-STELLA-b31b1b.svg)](https://www.biorxiv.org/content/10.1101/2025.07.01.662467v2)
[![arXiv](https://img.shields.io/badge/arXiv-2507.02004-b31b1b.svg)](https://arxiv.org/abs/2507.02004)
[![🦞 Claw4Science - Biomedicine](https://img.shields.io/badge/🦞_Claw4Science-Biomedicine-10b981)](https://claw4science.org/#project-runchuan-bu-bioclaw)
</div>

<br/><br/>

<h2 align="center">💬 Visit Our Homepage & Join WeChat Group</h2>

<div align="center">
<table>
  <tr>
    <td align="center">
      <a href="https://ivegotmagicbean.github.io/BioClaw-Page/">
        <img src="https://raw.githubusercontent.com/IveGotMagicBean/BioClaw-Page/main/png/EN_Homepage.png" width="650" alt="BioClaw Website"/>
        <br/><br/>
        <img src="https://img.shields.io/badge/WeChat-Visit_Homepage_&_Join_Group-07c160?style=for-the-badge&logo=wechat&logoColor=white" height="50" alt="Join WeChat"/>
      </a>
      <br/><br/>
      <h3>👆 Click above to visit our homepage and scan the QR code to join WeChat group!</h3>
    </td>
  </tr>
</table>
</div>


<br/><br/>

<h2 align="center">📄 Technical Document</h2>
<div align="center">
<table>
  <tr>
    <td align="center">
      <a href="https://www.biorxiv.org/content/10.64898/2026.04.11.716807v1">
        <img src="docs/images/tech_doc_card.png" width="650" alt="BioClaw Technical Document"/>
        <br/><br/>
        <img src="https://img.shields.io/badge/Download-Technical_Document_PDF-2b6cb0?style=for-the-badge&logo=adobeacrobatreader&logoColor=white" height="50" alt="Download PDF"/>
      </a>
      <br/><br/>
      <h3>👆 Click above to read the full technical documentation</h3>
    </td>
  </tr>
</table>
</div>

<br/><br/>

<div align="center">

**BioClaw** brings the power of computational biology directly into WhatsApp group chats. Researchers can run BLAST searches, render protein structures, generate publication-quality plots, perform sequencing QC, and search the literature — all through natural language messages.

Built on the [NanoClaw](https://github.com/qwibitai/nanoclaw) architecture with bioinformatics tools and skills from the [STELLA](https://github.com/zaixizhang/STELLA) project, powered by the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-sdk).

<p align="center">
  New BioClaw-compatible skills can be developed either directly in BioClaw or in <a href="https://github.com/zongtingwei/Bioclaw_Skills_Hub">Bioclaw_Skills_Hub</a>, which can serve as a staging space for early iteration and testing before useful skills are promoted into the main BioClaw repository. Skills that prove practical and stable may later be integrated into BioClaw itself. To get newly promoted skills and other updates from BioClaw, pull the latest version of this repository with <code>git pull</code>.
</p>
</div>

## Contents

- [Overview](#overview)
- [What's New](#whats-new)
- [Quick Start](#quick-start)
- [Beginner Guide](#beginner-guide)
- [Messaging channels](#messaging-channels)
- [Demo Examples](#demo-examples)
- [System Architecture](#system-architecture)
- [Skills & Skills Hub](#skills--skills-hub)
- [Included Tools](#included-tools)
- [Project Structure](#project-structure)
- [Citation](#citation)
- [License](#license)

## Overview

The rapid growth of biomedical data, tools, and literature has created a fragmented research landscape that outpaces human expertise. Researchers frequently need to switch between command-line bioinformatics tools, visualization software, databases, and literature search engines — often across different machines and environments.

**BioClaw** addresses this by providing a conversational interface to a comprehensive bioinformatics toolkit. By messaging `@Bioclaw` in a WhatsApp group, researchers can:

- **Sequence Analysis** — Run BLAST searches against NCBI databases, align reads with BWA/minimap2, and call variants
- **Quality Control** — Generate FastQC reports on sequencing data with automated interpretation
- **Structural Biology** — Fetch and render 3D protein structures from PDB with PyMOL
- **Data Visualization** — Create volcano plots, heatmaps, and expression figures from CSV data
- **Literature Search** — Query PubMed for recent papers with structured summaries
- **Image-based Wet-Lab Interpretation** — Analyze gel/blot photos captured from camera or uploaded in chat (e.g., SDS-PAGE lane quality and target-band checks)
- **Workspace Management** — Triage files, recommend analysis steps, and manage shared group workspaces

Results — including images, plots, and structured reports — are delivered directly back to the chat.

## What's New

Recent updates make BioClaw feel much closer to a real multi-chat research workspace:

- **Multiple web chats, each with its own memory** — the local web UI now lets you open separate threads like ChatGPT, so one chat can stay on literature search while another focuses on QC or plotting.
- **A built-in control layer in chat** — you can now manage the current thread directly in chat with commands like `/status`, `/doctor`, `/threads`, `/new`, `/use`, `/rename`, `/archive`, `/workspace`, `/provider`, and `/model`.
- **Host-side SSH straight from chat** — you can type `ssh <host-alias>` or `ssh <host-alias> -- <command>` in the chat box and BioClaw will run it from the host using your configured SSH aliases.
- **Per-thread working directory** — `/dir` lets each thread remember its own default folder inside the workspace, so different chats can work in different subdirectories without stepping on each other.
- **Reusable shortcuts for recurring workflows** — `/commands` and `/alias` let you save common prompts as short commands, so repeated lab routines do not need to be typed from scratch every time.
- **Skill visibility and preference control** — `/skills` shows the installed BioClaw skill modules and lets you mark preferred ones for the current thread or agent.
- **Better local web management** — the browser UI now has a thread list, rename/archive controls, and a lightweight management panel for status and diagnostics.
- **Quick OpenRouter health check** — `npm run check:openrouter` sends a tiny test request using your current `.env` so you can tell whether the key works before debugging the full app.

## Quick Start

If you're not yet comfortable with Docker, `.env`, workspaces, allowlists, or mounts, start here instead:

- **[docs/BEGINNER_GUIDE.md](docs/BEGINNER_GUIDE.md)**
  A step-by-step onboarding doc covering API/provider switching, what a workspace is, when you need an allowlist, how to configure extra mounts, and how to verify the results.

## Beginner Guide

Zero-to-first-analysis walkthrough for non-technical users:

- **[docs/BEGINNER_GUIDE.md](docs/BEGINNER_GUIDE.md)**

### Prerequisites

- **macOS / Linux / Windows** (Windows requires PowerShell 5.1+)
- Node.js 20+
- Docker Desktop
- Anthropic API key or OpenRouter API key

### Installation

**One-command setup** (recommended for first-time users):

<details>
<summary><b>macOS / Linux</b></summary>

```bash
git clone https://github.com/Runchuan-BU/BioClaw.git
cd BioClaw
bash scripts/setup.sh
```

</details>

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
git clone https://github.com/Runchuan-BU/BioClaw.git
cd BioClaw
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

</details>

The setup script will check prerequisites, install dependencies, build the Docker image, and walk you through API key configuration interactively.

**Manual setup:**

```bash
git clone https://github.com/Runchuan-BU/BioClaw.git
cd BioClaw
npm install
cp .env.example .env        # Edit with your API keys (see model section below)
docker build --no-cache -t bioclaw-agent:latest container/ # uncomment Dockerfile image source if you meet 100 errors.
npm start
```

### Model Provider Configuration

BioClaw now supports two provider paths:

- **Anthropic** — default, keeps the original Claude Agent SDK flow
- **OpenRouter / OpenAI-compatible** — optional path for OpenRouter and similar `/chat/completions` providers
- **OpenAI Codex login** — reuse a local `codex login` / ChatGPT sign-in, no API key required

Create a `.env` file in the project root and choose **one** of the following setups.

**Option A — Anthropic (default)**

```bash
ANTHROPIC_API_KEY=your_anthropic_key
```

**Option B — OpenRouter** (Gemini, DeepSeek, Claude, GPT, and more)

```bash
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=deepseek/deepseek-chat-v3.1
```

Popular model IDs: `deepseek/deepseek-chat-v3.1`, `deepseek/deepseek-v4-pro`, `google/gemini-2.5-flash`, `anthropic/claude-3.5-sonnet`. Full list: [openrouter.ai/models](https://openrouter.ai/models)

**Note:** Use models that support [tool calling](https://openrouter.ai/models?supported_parameters=tools) (e.g. DeepSeek, Gemini, Claude). Session history is preserved within a container session; after idle timeout, a new container starts with a fresh context.

**Generic OpenAI-compatible setup**

```bash
MODEL_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=your_api_key
OPENAI_COMPATIBLE_BASE_URL=https://your-provider.example/v1
OPENAI_COMPATIBLE_MODEL=your-model-name
```

**Option C — Reuse local Codex CLI login**

```bash
MODEL_PROVIDER=openai-codex
OPENAI_CODEX_MODEL=gpt-5.4
```

Requirements:

- `codex` is installed on the host and already signed in
- `~/.codex/auth.json` exists and is valid

BioClaw will reuse the host Codex login and keep Codex thread state inside the group session directory so GPT sessions can resume across messages.

After updating `.env`, restart BioClaw:

```bash
npm run dev
```

When a container starts, `docker logs <container-name>` will show which provider path is active.

### Usage

In any connected chat, simply message:

```
@Bioclaw <your request>
```

## Messaging channels

Supported platforms include **WhatsApp** (default), **Feishu (Lark)**, **WeCom**, **Discord**, **Slack** (Socket Mode), **WeChat** (fully supported), **QQ** and optional **local web** (browser) chat. Full setup steps, env vars, and disabling channels are in **[docs/CHANNELS.md](docs/CHANNELS.md)** (简体中文：[docs/CHANNELS.zh-CN.md](docs/CHANNELS.zh-CN.md)).


### WhatsApp Integration Example
> BioClaw supports WhatsApp group workflows for conversational task requests and in-chat delivery of analysis results.

<img src="ExampleTask/1.jpg" width="300" />

### Feishu (Lark) Integration Example
> BioClaw also supports Feishu/Lark conversations for interactive task requests and result delivery in chat.

<img src="docs/images/feishu/feishu-bioclaw.jpg" width="300" />

### WeCom Integration Example
> BioClaw also supports WeCom conversations for team collaboration and in-chat analysis result delivery.

<img src="docs/images/wecom/wecom-bioclaw.jpg" width="300" />

### Discord Integration Example
> BioClaw supports Discord channel workflows. Screenshot example will be added in a future update.

### Slack (Socket Mode) Integration Example
> BioClaw supports Slack (Socket Mode) workflows. Screenshot example will be added in a future update.

### WeChat Integration Example
> BioClaw supports one-click WeChat onboarding and in-chat file handoff workflows (send docs/images, then continue analysis in the same thread).

<img src="docs/images/weixin/weixin-bioclaw.jpg" width="300" />

### QQ Integration Example
> BioClaw also supports QQ-based conversations for task requests and chat-native result delivery.

<img src="docs/images/qq/qq-deepseek-1.jpg" width="300" />

### Local Web UI (Dashboard) Example
> The local web channel includes both chat and the built-in dashboard (Lab trace) for timeline observability.

<img src="docs/images/dashboard/UI-bioclaw.jpg" width="1000" />

**Lab trace** (SSE timeline, workspace tree) is built into the local web UI — no extra config needed. See **[docs/DASHBOARD.md](docs/DASHBOARD.md)**.

### SSH From Chat

BioClaw can execute host-side SSH commands directly from the chat control plane. This is designed for cases like checking a remote login node, tailing a result file, or running a short diagnostic command on another server without leaving the conversation.

Configure host aliases in `~/.ssh/config`, for example:

```sshconfig
Host lambda-cloud-54-140
  HostName 192.222.54.140
  User ubuntu
  IdentityFile ~/.ssh/zaixi_lambda.pem
  IdentitiesOnly yes
```

Then use these commands in chat:

```text
/ssh list
ssh lambda-cloud-54-140
ssh lambda-cloud-54-140 -- hostname
/ssh run lambda-cloud-54-140 -- ls -la ~
```

By default BioClaw reads simple aliases from `~/.ssh/config`. To restrict it further, set `BIOCLAW_SSH_ALLOWED_HOSTS` in `.env`.

## Second Quick Start

Just send the message to OpenClaw:

```text
install https://github.com/Runchuan-BU/BioClaw
```

See the [ExampleTask](ExampleTask/ExampleTask.md) document for 6 ready-to-use demo prompts with expected outputs.

## Demo Examples

Below are live demonstrations of BioClaw handling real bioinformatics tasks across mainstream channels (WhatsApp, QQ, WeCom, WeChat, Feishu/Lark, and local web UI).

### 1. Workspace Triage & Next Steps
> Analyze files in a shared workspace and recommend the best next analysis steps.

<div align="center">
<img src="ExampleTask/1.jpg" width="300">
</div>

---

### 2. FastQC Quality Control
> Run FastQC on paired-end FASTQ files and deliver the QC report with key findings.

<div align="center">
<img src="ExampleTask/5.jpg" width="300">
</div>

---

### 3. BLAST Sequence Search
> BLAST a protein sequence against the NCBI nr database and return structured top hits.

<div align="center">
<img src="ExampleTask/4.jpg" width="300">
</div>

---

### 4. Volcano Plot Generation
> Create a differential expression volcano plot from a CSV file and interpret the results.

<div align="center">
<img src="ExampleTask/6.jpg" width="300">
</div>

---

### 5. Protein Structure Rendering
> Fetch a PDB structure, render it in rainbow coloring with PyMOL, and send the image.

<div align="center">
<img src="ExampleTask/3.jpg" width="300">
</div>

---

### 6. PubMed Literature Search
> Search PubMed for recent high-impact papers and provide structured summaries.

<div align="center">
<img src="ExampleTask/2.jpg" width="300">
</div>

---

### 7. Hydrogen Bond Analysis
> Visualize hydrogen bonds between a ligand and protein in PDB 1M17.

<img src="docs/images/pymol-hydrogen-bonds-en.png" width="600" />

---

### 8. Binding Site Visualization
> Show residues within 5Å of ligand AQ4 in PDB 1M17.

<img src="docs/images/pymol-binding-site.png" width="600" />

---

### 9. SDS-PAGE Gel Photo Review (WhatsApp Camera/Upload)
> Capture or upload a gel image in WhatsApp, then ask BioClaw to assess lane quality and whether major bands match expected targets.

<img src="docs/images/whatsapp-凝胶.jpg" width="420" />

---

## System Architecture

BioClaw is built on the [NanoClaw](https://github.com/qwibitai/nanoclaw) container-based agent architecture, extended with biomedical tools and domain knowledge from the [STELLA](https://github.com/zaixizhang/STELLA) framework.

```
WhatsApp ──► Node.js Orchestrator ──► SQLite (state) ──► Docker Container
                                                              │
                                                     Claude Agent SDK
                                                              │
                                                   ┌──────────┴──────────┐
                                                   │   Bioinformatics    │
                                                   │      Toolbox        │
                                                   ├─────────────────────┤
                                                   │ BLAST+  │ SAMtools  │
                                                   │ BWA     │ BEDTools  │
                                                   │ FastQC  │ PyMOL     │
                                                   │ minimap2│ seqtk     │
                                                   ├─────────────────────┤
                                                   │   Python Libraries  │
                                                   ├─────────────────────┤
                                                   │ BioPython │ pandas  │
                                                   │ RDKit     │ scanpy  │
                                                   │ PyDESeq2  │ pysam   │
                                                   │ matplotlib│ seaborn │
                                                   └─────────────────────┘
```

**Key design principles (inherited from NanoClaw):**

| Component | Description |
|-----------|-------------|
| **Container Isolation** | Each conversation group runs in its own Docker container with pre-installed bioinformatics tools |
| **Filesystem IPC** | Text and image results are communicated between the agent and orchestrator via the filesystem |
| **Per-Group State** | SQLite database tracks messages, sessions, and group-specific workspaces |
| **Channel Agnostic** | Channels self-register at startup; the orchestrator connects whichever ones have credentials |

**Biomedical capabilities (attributed to STELLA):**

The bioinformatics tool suite and domain-specific skills — including sequence analysis, structural biology, literature mining, and data visualization — draw from the tool ecosystem developed in the [STELLA](https://github.com/zaixizhang/STELLA) project, a self-evolving multi-agent framework for biomedical research.

## Skills & Skills Hub

BioClaw uses a two-tier skill system:

- **Built-in skills** — ~25 core skills bundled in the container image (BLAST search, differential expression, single-cell preprocessing, database queries, PubMed search, etc.). Always available, no setup needed.
- **[Skills Hub](https://github.com/zongtingwei/Bioclaw_Skills_Hub)** — A community-maintained repository with 70+ specialized skills across 10 domains (protein design, spatial transcriptomics, EHR analysis, multi-omics integration, etc.).

The agent automatically discovers Hub skills at runtime. When a user's task isn't covered by built-in skills, the agent fetches the relevant skill definition from the Hub via GitHub, caches it locally, and executes it — no manual installation required.

To contribute new skills, see the [Skills Hub contributing guide](https://github.com/zongtingwei/Bioclaw_Skills_Hub/blob/main/CONTRIBUTING.md). Skills that prove stable and widely useful may be promoted into BioClaw's built-in set.

## Included Tools

### Command-Line Bioinformatics
| Tool | Purpose |
|------|---------|
| **BLAST+** | Sequence similarity search against NCBI databases |
| **SAMtools** | Manipulate alignments in SAM/BAM format |
| **BEDTools** | Genome arithmetic and interval manipulation |
| **BWA** | Burrows-Wheeler short read aligner |
| **minimap2** | Long read and assembly alignment |
| **FastQC** | Sequencing quality control reports |
| **fastp** | FASTQ filtering and trimming (QC/preprocessing) |
| **MultiQC** | Aggregate QC reports into one summary |
| **seqtk** | FASTA/FASTQ file manipulation |
| **seqkit** | FASTA/FASTQ toolkit (extended) |
| **BCFtools** | Variant calling and VCF/BCF manipulation |
| **tabix** | Index/query compressed VCF/BED (bgzip/tabix) |
| **pigz** | Parallel gzip compression/decompression |
| **SRA Toolkit** | Download data from NCBI SRA (prefetch/fasterq-dump) |
| **Salmon** | RNA-seq transcript quantification |
| **kallisto** | RNA-seq transcript quantification |
| **PyMOL** | Molecular visualization and rendering |

### Python Libraries
| Library | Purpose |
|---------|---------|
| **BioPython** | Biological computation (sequences, PDB, BLAST parsing) |
| **pandas / NumPy / SciPy** | Data manipulation and scientific computing |
| **matplotlib / seaborn** | Publication-quality plotting |
| **scikit-learn** | Machine learning for biological data |
| **RDKit** | Cheminformatics and molecular descriptors |
| **PyDESeq2** | Differential expression analysis |
| **scanpy** | Single-cell RNA-seq analysis |
| **pysam** | SAM/BAM file access from Python |

## Scripts

All utility scripts are in the `scripts/` directory:

| Command | Script | Description |
|---------|--------|-------------|
| `bash scripts/setup.sh` | `scripts/setup.sh` | One-command setup for macOS/Linux |
| `powershell scripts\setup.ps1` | `scripts/setup.ps1` | One-command setup for Windows |
| `npm run web` | `scripts/start-web.mjs` | Start BioClaw with local web UI (chat + lab trace) |
| `npm run open:web` | `scripts/open-local-web.mjs` | Open the web UI in default browser |
| `npm run stop:web` | `scripts/stop-bioclaw-web.mjs` | Stop the web server process |
| `npm run check:openrouter` | `scripts/check-openrouter.mjs` | Send a minimal test request to OpenRouter using the current `.env` |
| `bash scripts/clear-local-web.sh` | `scripts/clear-local-web.sh` | Clear all local-web chat history and trace events |
| `npx tsx scripts/test-cli.ts "prompt"` | `scripts/test-cli.ts` | Run a single prompt through the container agent (CLI test) |
| `npx tsx scripts/manage-groups.ts list` | `scripts/manage-groups.ts` | Manage WhatsApp group registrations (list / register / remove) |
| `python3 scripts/demo.py` | `scripts/demo.py` | TP53 gene analysis demo (runs inside container) |

## Notebook Export

Every successful agent run automatically generates a reproducible Jupyter notebook (`.ipynb`).
Notebooks are saved to:

```
groups/{workspace}/notebooks/{timestamp}.ipynb
```

For example, a Slack DM conversation might produce:
```
groups/slack-E1KYFDKN/notebooks/2026-04-01T07-31-54.ipynb
```

Each notebook contains:
- **Header cell** — date, workspace, and the original user prompt
- **Code cells** — Python scripts and bash commands the agent executed
- **Markdown cells** — agent reasoning, file writes, and analysis summaries

Open notebooks in VS Code (with the [Jupyter extension](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter)), JupyterLab, or any `.ipynb`-compatible viewer.

## Project Structure

```
BioClaw/
├── src/                       # Node orchestrator
│   └── channels/              # WhatsApp, WeCom, Feishu, Discord, Slack, WeChat, local web
├── container/                 # Agent Dockerfile + skills
├── scripts/                   # Utility scripts (setup, web, testing)
├── groups/                    # Per-group workspace & CLAUDE.md
├── docs/
│   ├── CHANNELS.md            # Messaging platform setup (EN)
│   ├── CHANNELS.zh-CN.md      # Messaging platform setup (ZH)
│   ├── DASHBOARD.md           # Lab trace & observability
│   ├── SECURITY.md            # Trust model & container isolation
│   ├── SPEC.md                # Technical specification
│   ├── DEBUG_CHECKLIST.md     # Troubleshooting guide
│   └── images/                # Doc screenshots
├── ExampleTask/               # Demo prompts + screenshots
└── README.md
```

## Citation

BioClaw builds upon the STELLA framework. If you use BioClaw in your research, please cite:

```bibtex
@article{jin2025stella,
  title={STELLA: Towards a Biomedical World Model with Self-Evolving Multimodal Agents},
  author={Jin, Ruofan and Xu, Mingyang and Meng, Fei and Wan, Guancheng and Cai, Qingran and Jiang, Yize and Han, Jin and Chen, Yuanyuan and Lu, Wanqing and Wang, Mengyang and Lan, Zhiqian and Jiang, Yuxuan and Liu, Junhong and Wang, Dongyao and Cong, Le and Zhang, Zaixi},
  journal={bioRxiv},
  year={2025},
  doi={10.1101/2025.07.01.662467}
}
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
