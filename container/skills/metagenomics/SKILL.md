---
name: metagenomics
description: Shotgun metagenomics workflow with host-depletion-aware QC, taxonomic profiling, functional profiling, AMR follow-up, and reproducible community output tables.
tool_type: mixed
primary_tool: Kraken2
---

# Metagenomics

## Version Compatibility

Reference examples assume:

- `fastp` 0.23+
- `kraken2` 2.1+
- `bracken` 2.8+
- `metaphlan` 4+
- `humann` 3.9+

Verify the environment first:

- CLI: `kraken2 --version`, `bracken -v`, `metaphlan --version`, `humann --version`

## Overview

Use this skill for shotgun metagenomics when the user needs:

- QC and host depletion review
- taxonomic abundance tables
- functional pathway profiles
- AMR or strain-level follow-up

## When To Use This Skill

- the data are shotgun metagenomics rather than amplicon sequencing
- the user wants species or genus abundances, function, or resistance summaries
- multiple samples need cohort-level comparison

## Quick Route

- host-associated samples: perform host depletion before interpretation
- taxonomy only: `kraken2 + bracken` is a common pragmatic route
- function only or plus taxonomy: add `humann`
- strain claims require more evidence than top-level taxonomy calls

## Progressive Disclosure

- Read [technical_reference.md](technical_reference.md) for database choice, host contamination review, and functional profiling caveats.
- Read [commands_and_thresholds.md](commands_and_thresholds.md) for command-line patterns, thresholds, and output layout.

## Expected Inputs

- paired or single-end metagenomic FASTQ
- sample metadata
- taxonomy and optional function databases

## Expected Outputs

- `results/taxonomy/bracken_species.tsv`
- `results/taxonomy/bracken_genus.tsv`
- `results/function/pathabundance.tsv`
- `results/amr/amr_summary.tsv`
- `qc/read_processing_summary.tsv`

## Starter Pattern

```bash
fastp \
  -i sample_R1.fastq.gz \
  -I sample_R2.fastq.gz \
  -o qc/sample.clean.R1.fastq.gz \
  -O qc/sample.clean.R2.fastq.gz \
  --html qc/sample.fastp.html \
  --json qc/sample.fastp.json

kraken2 \
  --db $KRAKEN_DB \
  --paired qc/sample.clean.R1.fastq.gz qc/sample.clean.R2.fastq.gz \
  --report results/taxonomy/sample.kraken.report \
  --output results/taxonomy/sample.kraken.out \
  --confidence 0.1
```

## Workflow

### 1. Run read QC and optional host depletion

At minimum, inspect read quality, adapter content, and retained reads. For host-associated samples, remove host reads before community interpretation.

### 2. Profile taxonomy

Use a k-mer or marker-based profiler. Document the database and version because abundance results depend strongly on the reference.

### 3. Refine abundance tables

Convert raw classification to species or genus abundance tables suitable for cohort comparison.

### 4. Add function or AMR when requested

Run pathway or AMR profiling only after confirming taxonomic QC and read retention are reasonable.

### 5. Export cohort-ready outputs

Save per-sample tables and merged matrices with clear metadata joins.

## Output Artifacts

```text
results/
├── taxonomy/
│   ├── sample.kraken.report
│   ├── bracken_species.tsv
│   └── bracken_genus.tsv
├── function/
│   └── pathabundance.tsv
└── amr/
    └── amr_summary.tsv
qc/
├── read_processing_summary.tsv
└── sample.fastp.html
```

## Quality Review

- retained reads after QC should be reported explicitly
- host-associated samples with large host contamination need a clear host depletion statement
- avoid over-interpreting taxa with extremely low abundance
- abundance comparisons should state whether values are relative abundance, counts, or normalized function estimates

## Anti-Patterns

- comparing outputs from different databases as if they were directly interchangeable
- making strain-level claims from genus-level evidence
- ignoring host contamination in human-associated or plant-associated samples
- mixing taxonomy-only and pathway outputs without clarifying what each table means

## Related Skills

- Microbiome Amplicon
- Pathogen Epidemiological Genomics
- Phylogenetics

## Optional Supplements

- `scikit-bio`
