---
name: proteomics
description: Mass spectrometry proteomics QC, quantification, comparative analysis, and export for DDA, DIA, and protein-level result tables.
tool_type: python
primary_tool: pyopenms
---

# Proteomics

## Version Compatibility

Reference examples assume:

- `pyopenms` 3.0+
- `pandas` 2.2+
- `numpy` 1.26+
- `seaborn` 0.13+

## Overview

Use this skill when the user needs:

- proteomics QC
- protein table cleanup
- replicate review
- differential abundance analysis
- publication-ready proteomics figures

## When To Use This Skill

- MaxQuant, FragPipe, DIA-NN, or similar outputs exist
- the task is protein-level quantification or comparative proteomics
- missingness, batch effects, and replicate quality need review before interpretation

## Quick Route

- DDA and DIA should not be treated identically
- protein-level tables should remain distinct from peptide-level tables
- QC comes before differential analysis

## Progressive Disclosure

- Read [technical_reference.md](technical_reference.md) for assay branching, QC interpretation, and missingness handling.
- Read [commands_and_thresholds.md](commands_and_thresholds.md) for table-loading patterns, QC thresholds, and output conventions.

## Expected Inputs

- protein or peptide result table
- sample metadata
- assay context: DDA, DIA, PTM-enriched, or targeted

## Expected Outputs

- `results/protein_abundance.tsv`
- `qc/proteomics_qc_summary.tsv`
- `figures/correlation_heatmap.pdf`
- `figures/missingness.pdf`
- `results/differential_proteins.tsv`

## Starter Pattern

```python
import pandas as pd

protein_df = pd.read_csv("protein_groups.tsv", sep="\t")
sample_cols = [c for c in protein_df.columns if c.startswith("LFQ intensity")]
matrix = protein_df[sample_cols].replace(0, pd.NA)
qc = pd.DataFrame({
    "n_proteins": matrix.notna().sum(),
    "missing_pct": matrix.isna().mean() * 100,
})
qc.to_csv("qc/proteomics_qc_summary.tsv", sep="\t")
```

## Workflow

### 1. Clarify assay and table level

- DDA versus DIA
- peptide versus protein table
- PTM-enriched versus unenriched data

### 2. Run QC before comparisons

Inspect:

- missingness
- replicate correlation
- batch effects
- intensity distributions

### 3. Normalize and summarize consistently

Keep the normalization approach explicit and do not collapse peptides into proteins without documenting the rule.

### 4. Perform comparative analysis

Use replicate-aware differential abundance with clear filtering and missingness policy.

### 5. Export interpretable artifacts

Save both the cleaned abundance matrix and the differential results table.

## Output Artifacts

```text
results/
├── protein_abundance.tsv
└── differential_proteins.tsv
qc/
└── proteomics_qc_summary.tsv
figures/
├── correlation_heatmap.pdf
├── missingness.pdf
└── intensity_density.pdf
```

## Quality Review

- overall missingness `> 30%` should trigger caution
- technical replicate correlation should usually be `> 0.9`
- biological replicate correlation much below `0.8` deserves review
- do not trust differential calls before batch structure and missingness are understood

## Anti-Patterns

- mixing peptide and protein tables in one downstream matrix
- running differential abundance before QC
- ignoring missingness patterns
- hiding whether values are raw, normalized, or imputed

## Related Skills

- Metabolomics
- Structural Biology

## Optional Supplements

- `pyopenms`
