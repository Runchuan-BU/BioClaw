<div align="center">
<img src="bioclaw_logo.jpg" width="200">


# BioClaw

### AI-Powered Bioinformatics Research Assistant on WhatsApp

[English](README.md) | [简体中文](README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Runchuan-BU/BioClaw)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/Runchuan-BU/BioClaw/blob/main/LICENSE)
[![Paper](https://img.shields.io/badge/bioRxiv-STELLA-b31b1b.svg)](https://www.biorxiv.org/content/10.1101/2025.07.01.662467v2)
[![arXiv](https://img.shields.io/badge/arXiv-2507.02004-b31b1b.svg)](https://arxiv.org/abs/2507.02004)

**BioClaw** brings the power of computational biology directly into WhatsApp group chats. Researchers can run BLAST searches, render protein structures, generate publication-quality plots, perform sequencing QC, and search the literature — all through natural language messages.

Built on the [NanoClaw](https://github.com/qwibitai/nanoclaw) architecture with bioinformatics tools and skills from the [STELLA](https://github.com/zaixizhang/STELLA) project, powered by the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-sdk).

New BioClaw-compatible skills are first contributed to [Bioclaw_Skills_Hub](https://github.com/zongtingwei/Bioclaw_Skills_Hub), where they can be iterated and tested before being promoted into the main BioClaw repository. If you want to contribute new skills, please submit them there first. Skills that prove useful and stable in practice may later be integrated into BioClaw itself. To get newly promoted skills and updates from BioClaw, pull the latest version of this repository with `git pull`.

</div>

## Join WeChat Group

Welcome to join our WeChat group to discuss and exchange ideas! Scan the QR code below to join:

<p align="center">
  <img src="wechat_group.jpg" width="50%" alt="WeChat Group QR Code"/>
  <br/>
  <em>Scan to join the BioClaw community</em>
</p>

## Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Messaging channels](#messaging-channels)
- [Demo Examples](#demo-examples)
- [System Architecture](#system-architecture)
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
- **Workspace Management** — Triage files, recommend analysis steps, and manage shared group workspaces

Results — including images, plots, and structured reports — are delivered directly back to the chat.

## Quick Start

### Prerequisites

- macOS or Linux
- Node.js 20+
- Docker Desktop
- Anthropic API key or OpenRouter API key

### Installation

**One-command setup** (recommended for first-time users):

```bash
git clone https://github.com/Runchuan-BU/BioClaw.git
cd BioClaw
bash setup.sh
```

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

Popular model IDs: `deepseek/deepseek-chat-v3.1`, `google/gemini-2.5-flash`, `anthropic/claude-3.5-sonnet`. Full list: [openrouter.ai/models](https://openrouter.ai/models)

**Note:** Use models that support [tool calling](https://openrouter.ai/models?supported_parameters=tools) (e.g. DeepSeek, Gemini, Claude). Session history is preserved within a container session; after idle timeout, a new container starts with a fresh context.

**Generic OpenAI-compatible setup**

```bash
MODEL_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=your_api_key
OPENAI_COMPATIBLE_BASE_URL=https://your-provider.example/v1
OPENAI_COMPATIBLE_MODEL=your-model-name
```

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

Supported platforms include **WhatsApp** (default), **Feishu (Lark)**, **WeCom**, **Discord**, **Slack** (Socket Mode), and optional **local web** (browser) chat. Full setup steps, env vars, and disabling channels are in **[docs/CHANNELS.md](docs/CHANNELS.md)** (简体中文：[docs/CHANNELS.zh-CN.md](docs/CHANNELS.zh-CN.md)).

**Lab trace** (SSE timeline, workspace tree) is built into the local web UI — no extra config needed. See **[docs/DASHBOARD.md](docs/DASHBOARD.md)**.

## Second Quick Start

Just send the message to OpenClaw:

```text
install https://github.com/Runchuan-BU/BioClaw
```

See the [ExampleTask](ExampleTask/ExampleTask.md) document for 6 ready-to-use demo prompts with expected outputs.

## Demo Examples

Below are live demonstrations of BioClaw handling real bioinformatics tasks via WhatsApp.

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
| `bash setup.sh` | `scripts/setup.sh` | One-command setup: checks Node.js, installs deps, builds Docker image, configures `.env` |
| `npm run web` | `scripts/start-web.mjs` | Start BioClaw with local web UI (chat + lab trace) |
| `npm run open:web` | `scripts/open-local-web.mjs` | Open the web UI in default browser |
| `npm run stop:web` | `scripts/stop-bioclaw-web.mjs` | Stop the web server process |
| `bash scripts/clear-local-web.sh` | `scripts/clear-local-web.sh` | Clear all local-web chat history and trace events |
| `npx tsx scripts/test-cli.ts "prompt"` | `scripts/test-cli.ts` | Run a single prompt through the container agent (CLI test) |
| `npx tsx scripts/manage-groups.ts list` | `scripts/manage-groups.ts` | Manage WhatsApp group registrations (list / register / remove) |
| `python3 scripts/demo.py` | `scripts/demo.py` | TP53 gene analysis demo (runs inside container) |

## Project Structure

```
BioClaw/
├── src/                       # Node orchestrator
├── container/                 # Agent image + runner
├── scripts/                   # Utility scripts (setup, web, testing)
├── groups/                    # Per-group workspace & CLAUDE.md
├── docs/
│   ├── CHANNELS.md            # Messaging platform setup (EN)
│   ├── CHANNELS.zh-CN.md      # Messaging platform setup (ZH)
│   └── images/                # Doc screenshots
├── ExampleTask/               # Demo prompts + screenshots
├── bioclaw_logo.jpg           # Project logo
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
