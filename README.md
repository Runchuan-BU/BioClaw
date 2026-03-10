<div align="center">
<img src="bioclaw_logo1.jpg" width="200">


# BioClaw

### AI-Powered Bioinformatics Research Assistant on WhatsApp

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Runchuan-BU/BioClaw)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/Runchuan-BU/BioClaw/blob/main/LICENSE)
[![Paper](https://img.shields.io/badge/bioRxiv-STELLA-b31b1b.svg)](https://www.biorxiv.org/content/10.1101/2025.07.01.662467v2)
[![arXiv](https://img.shields.io/badge/arXiv-2507.02004-b31b1b.svg)](https://arxiv.org/abs/2507.02004)

**BioClaw** brings the power of computational biology directly into WhatsApp group chats. Researchers can run BLAST searches, render protein structures, generate publication-quality plots, perform sequencing QC, and search the literature — all through natural language messages.

Built on the [NanoClaw](https://github.com/qwibitai/nanoclaw) architecture with bioinformatics tools and skills from the [STELLA](https://github.com/zaixizhang/STELLA) project, powered by the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-sdk).

</div>

---

## Contents

- [Overview](#overview)
- [Demo Examples](#demo-examples)
- [System Architecture](#system-architecture)
- [Included Tools](#included-tools)
- [Quick Start](#quick-start)
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
| **seqtk** | FASTA/FASTQ file manipulation |
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

## Quick Start

### Prerequisites

- macOS or Linux
- Node.js 20+
- Docker Desktop
- Anthropic API key

### Installation

```bash
# Clone the repository
git clone https://github.com/Runchuan-BU/BioClaw.git
cd BioClaw

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Anthropic API key and WhatsApp credentials

# Start BioClaw
npm start
```

### Usage

In any WhatsApp group where BioClaw is connected, simply message:

```
@Bioclaw <your request>
```

## Second Quick Start

Just send the message to OpenClaw:

```text
install https://github.com/Runchuan-BU/BioClaw
```

See the [ExampleTask](ExampleTask/ExampleTask.md) document for 6 ready-to-use demo prompts with expected outputs.

## Project Structure

```
BioClaw/
├── bioclaw_logo.jpg           # Project logo
├── ExampleTask/
│   ├── ExampleTask.md         # 6 demo prompts with descriptions
│   ├── 1.jpg                  # Workspace triage demo
│   ├── 2.jpg                  # PubMed search demo
│   ├── 3.jpg                  # Protein structure demo
│   ├── 4.jpg                  # BLAST search demo
│   ├── 5.jpg                  # FastQC QC demo
│   └── 6.jpg                  # Volcano plot demo
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

## Related Projects

- [STELLA](https://github.com/zaixizhang/STELLA) — Self-Evolving LLM Agent for Biomedical Research
- [NanoClaw](https://github.com/qwibitai/nanoclaw) — Lightweight container-based agent architecture
- [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-sdk) — Anthropic's SDK for building AI agents

## Acknowledgments

This project was developed in the **Le Cong Lab** at Stanford University and the **Mengdi Wang Lab** at Princeton University.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
