---
name: chip-seq
description: ChIP-seq peak calling and downstream interpretation with MACS3, signal track export, annotation, motif analysis, and differential binding review.
tool_type: mixed
primary_tool: MACS3
---

# ChIP Seq

## Version Compatibility

Reference examples assume:

- `macs3` 3.0+
- `samtools` 1.18+
- `deepTools` 3.5+

Before using commands, verify the installed environment:

- CLI: `macs3 --version`, `samtools --version`, `bamCoverage --version`
- If flags differ, inspect `--help` and adapt rather than forcing the example unchanged.

## Overview

Use this skill for:

- narrow or broad peak calling
- input-normalized signal tracks
- peak annotation
- motif follow-up
- differential binding review when replicates exist

## When To Use This Skill

- the user has aligned ChIP and optional input BAM files
- the deliverable includes peaks, browser tracks, or motif results
- the assay is TF ChIP or histone-mark ChIP and needs standard peak-centric processing

## Quick Route

- TF or narrow marks: use narrow peak mode first.
- H3K27me3, H3K36me3, or other broad marks: use `--broad`.
- Paired-end BAM: prefer `-f BAMPE`.
- No input control: still possible, but report the limitation explicitly.

## Progressive Disclosure

- Read [technical_reference.md](technical_reference.md) for QC gates, narrow-versus-broad logic, and replicate handling.
- Read [commands_and_thresholds.md](commands_and_thresholds.md) for MACS3 commands, parameter defaults, and output file conventions.

## Prerequisites

| Requirement | Narrow TF-style | Broad histone-style |
|---|---:|---:|
| usable uniquely mapped reads | `>= 10M` | `>= 20M` |
| matched input recommended | yes | yes |
| biological replicates recommended | `>= 2` | `>= 2` |

## Expected Inputs

- `chip.bam`
- `input.bam` when available
- reference genome build
- chromosome sizes if bigWig export is needed

## Expected Outputs

- `results/peaks/sample_peaks.narrowPeak` or `.broadPeak`
- `results/peaks/sample_summits.bed`
- `results/tracks/sample_treat_pileup.bw`
- `results/annotation/peak_annotation.tsv`
- `qc/chip_qc_summary.tsv`

## Starter Pattern

```bash
macs3 callpeak \
  -t chip.bam \
  -c input.bam \
  -f BAMPE \
  -g hs \
  -n sample \
  -q 0.01 \
  --outdir results/peaks
```

## Key Parameters

| Parameter | Typical value | Meaning |
|---|---|---|
| `-f` | `BAM` or `BAMPE` | paired-end should use `BAMPE` |
| `-g` | `hs`, `mm`, or numeric | effective genome size |
| `-q` | `0.01` or `0.05` | FDR cutoff for narrow peaks |
| `--broad` | broad marks only | broad peak mode |
| `--broad-cutoff` | `0.1` | broad-peak FDR cutoff |
| `-B --SPMR` | enabled for tracks | bedGraph for normalized signal |

## Workflow

### 1. Validate BAMs and replicate structure

Check:

- mapped read counts
- duplicate burden
- whether input control exists
- whether the mark is narrow or broad

### 2. Call peaks with MACS3

- narrow marks: `-q 0.01` is a good starting point
- broad marks: use `--broad --broad-cutoff 0.1`
- paired-end: `-f BAMPE`

### 3. Export signal tracks

Use `-B --SPMR`, sort the resulting bedGraph, then convert to bigWig for browser use.

### 4. Annotate and inspect peaks

Map peaks to promoters, gene bodies, or distal intervals and review top loci in a genome browser or track plot.

### 5. Run motif or differential follow-up

Only after peak quality looks credible and replicate structure supports the downstream question.

## Output Artifacts

```text
results/
├── peaks/
│   ├── sample_peaks.narrowPeak
│   ├── sample_summits.bed
│   └── sample_model.r
├── tracks/
│   ├── sample_treat_pileup.bdg
│   └── sample_treat_pileup.bw
└── annotation/
    └── peak_annotation.tsv
qc/
└── chip_qc_summary.tsv
```

## Quality Review

- TF ChIP-seq FRiP:
  - `< 0.01` poor
  - `0.01-0.05` usable but weak
  - `> 0.05` generally solid
- Histone broad-mark FRiP often differs; compare within assay type rather than against TF expectations.
- Use replicate concordance when available. Do not trust a single noisy replicate just because peaks were called.
- Check that top peaks occur in plausible loci and not only blacklisted or artifactual regions.

## Anti-Patterns

- treating broad and narrow marks with the same peak-calling setup
- calling peaks on unsorted or low-quality BAMs
- presenting motif hits without showing peak quality
- hiding that no input control was available

## Related Skills

- ATAC Seq
- Methylation Analysis
- Gene Regulatory Networks

## Optional Supplements

- `deeptools`
- `pysam`
