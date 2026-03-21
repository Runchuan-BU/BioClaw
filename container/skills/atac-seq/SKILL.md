---
name: atac-seq
description: ATAC-seq processing with assay QC, MACS3 peak calling, consensus peak matrices, differential accessibility, and motif or footprint follow-up.
tool_type: mixed
primary_tool: MACS3
---

# ATAC Seq

## Version Compatibility

Reference examples assume:

- `macs3` 3.0+
- `samtools` 1.18+
- `deepTools` 3.5+

Verify the runtime first:

- CLI: `macs3 --version`, `samtools --version`, `bamCoverage --version`

## Overview

Use this skill when the user needs:

- bulk ATAC-seq QC
- peak calling
- accessibility counting
- differential accessibility
- motif deviation or footprint follow-up

## When To Use This Skill

- the task is bulk ATAC-seq rather than ChIP-seq
- TSS enrichment, fragment periodicity, or FRiP need review
- the output should include peaks, counts, and downstream accessibility summaries

## Quick Route

- paired-end bulk ATAC: use `BAMPE`
- call peaks without control using ATAC-specific settings
- if TSS enrichment is poor, stop and flag data quality before interpretation

## Progressive Disclosure

- Read [technical_reference.md](technical_reference.md) for QC gates and assay-specific caveats.
- Read [commands_and_thresholds.md](commands_and_thresholds.md) for peak-calling commands, thresholds, and output conventions.

## Prerequisites

| Check | Guidance |
|---|---:|
| uniquely mapped reads | `>= 20M` preferred for strong bulk ATAC |
| TSS enrichment | `> 7` acceptable, `> 10` strong |
| FRiP | `> 0.2` often strong for good bulk ATAC |

## Expected Inputs

- paired-end ATAC BAM or FASTQ
- reference genome
- sample groups for comparisons

## Expected Outputs

- `results/peaks/sample_peaks.narrowPeak`
- `results/matrix/consensus_peak_counts.tsv`
- `results/diff_accessibility.tsv`
- `figures/tss_enrichment.pdf`
- `figures/fragment_size_distribution.pdf`

## Starter Pattern

```bash
macs3 callpeak \
  -t atac.bam \
  -f BAMPE \
  -g hs \
  -n sample \
  --nomodel \
  --shift -100 \
  --extsize 200 \
  -q 0.01 \
  --outdir results/peaks
```

## Key Parameters

| Parameter | Typical value | Notes |
|---|---|---|
| `-f` | `BAMPE` | paired-end ATAC should use fragment-aware mode |
| `--nomodel` | on | standard for ATAC |
| `--shift` | `-100` | common Tn5 offset convention |
| `--extsize` | `200` | common first-pass extension |
| `-q` | `0.01` | starting FDR threshold |

## Workflow

### 1. Validate assay QC

Review:

- TSS enrichment
- fragment size periodicity
- duplication
- mapped read depth

### 2. Call peaks with ATAC-specific settings

Use fragment-aware paired-end mode and Tn5-aware shifting or equivalent settings.

### 3. Build a consensus peak matrix

Merge peaks across samples, count fragments into consensus intervals, then produce a peak-by-sample matrix.

### 4. Test differential accessibility

Use replicate-aware statistics and report both effect size and adjusted significance.

### 5. Run motif or footprint follow-up

Only after peak quality and read depth support it.

## Output Artifacts

```text
results/
├── peaks/
│   ├── sample_peaks.narrowPeak
│   └── sample_summits.bed
├── matrix/
│   └── consensus_peak_counts.tsv
└── diff_accessibility.tsv
qc/
├── tss_enrichment.tsv
└── fragment_metrics.tsv
figures/
├── tss_enrichment.pdf
└── fragment_size_distribution.pdf
```

## Quality Review

- TSS enrichment below `7` should trigger caution.
- Strong nucleosome periodicity supports a good bulk ATAC library.
- FRiP below `0.1` is usually weak and needs scrutiny.
- Footprinting should not be trusted on low-depth or poor-quality libraries.

## Anti-Patterns

- using generic ChIP peak-calling defaults for ATAC
- running footprinting on weak libraries
- skipping TSS enrichment review
- merging peaks from mixed reference builds

## Related Skills

- ChIP Seq
- Gene Regulatory Networks
- Multiome And scATAC

## Optional Supplements

- `deeptools`
- `pysam`
