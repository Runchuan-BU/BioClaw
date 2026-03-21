---
name: differential-expression
description: Bulk transcriptomics differential expression with count-aware modeling, design validation, contrast handling, thresholded exports, and publication-ready DE figures.
tool_type: python
primary_tool: PyDESeq2
---

# Differential Expression

## Version Compatibility

Reference examples assume:

- `pydeseq2` 0.4+
- `pandas` 2.2+
- `numpy` 1.26+
- `matplotlib` 3.8+

Verify before use:

- Python: `python -c "import pydeseq2, pandas; print(pydeseq2.__version__, pandas.__version__)"`

## Overview

Use this skill for count-based DE from bulk RNA-seq or similar count matrices when the user needs:

- robust model fitting
- explicit contrasts
- ranked gene tables
- volcano and MA plots
- pathway-ready output tables

## When To Use This Skill

- raw count matrix and sample metadata are available
- the task is condition, treatment, or genotype comparison
- batch or pairing terms may need explicit modeling

## Quick Route

- no replicates: do not pretend formal DE is robust
- 2 replicates per group: possible but conservative interpretation
- 3 or more replicates per group: standard starting point

## Progressive Disclosure

- Read [technical_reference.md](technical_reference.md) for design formulas, confounding checks, and contrast logic.
- Read [commands_and_thresholds.md](commands_and_thresholds.md) for PyDESeq2 code, recommended filters, and output file conventions.

## Prerequisites

| Requirement | Recommendation |
|---|---:|
| minimum replicates per group | `>= 2` |
| preferred replicates per group | `>= 3` |
| input values | raw integer counts |

## Expected Inputs

- raw count matrix
- sample metadata
- explicit contrast such as treated vs control

## Expected Outputs

- `results/de_results.tsv`
- `results/de_ranked_genes.tsv`
- `figures/volcano.pdf`
- `figures/ma_plot.pdf`
- `qc/sample_pca.pdf`

## Starter Pattern

```python
from pydeseq2.dds import DeseqDataSet
from pydeseq2.ds import DeseqStats

dds = DeseqDataSet(
    counts=counts_df,
    metadata=metadata_df,
    design_factors=["condition", "batch"],
)
dds.deseq2()
stats = DeseqStats(dds, contrast=("condition", "treated", "control"))
stats.summary()
res = stats.results_df.sort_values("padj")
res.to_csv("results/de_results.tsv", sep="\t")
```

## Workflow

### 1. Validate the design

Check:

- replicate counts
- factor levels
- batch balance
- paired structure
- confounded variables

### 2. Fit a count-aware model

Use raw counts, not TPM or log-normalized expression, for count-based DE frameworks.

### 3. Apply explicit filtering and ranking

Common reporting thresholds:

- `padj < 0.05`
- `abs(log2FoldChange) >= 1`

Export both the full table and a thresholded table.

### 4. Visualize results

At minimum:

- sample PCA
- volcano plot
- MA plot

### 5. Export pathway-ready artifacts

Produce a ranked gene list sorted by signed effect or Wald statistic for enrichment workflows.

## Output Artifacts

```text
results/
├── de_results.tsv
├── de_significant.tsv
└── de_ranked_genes.tsv
figures/
├── sample_pca.pdf
├── volcano.pdf
└── ma_plot.pdf
qc/
└── design_check.tsv
```

## Quality Review

- raw counts only for model fitting
- no fully confounded batch and condition
- outlier samples reviewed before publication claims
- all final tables should include `baseMean`, `log2FoldChange`, `pvalue`, and `padj`

## Anti-Patterns

- running DE on TPM as if it were count-based
- omitting batch or pairing terms that clearly exist
- showing only thresholded genes and hiding the full table
- using p-value alone without effect size

## Related Skills

- Bulk RNA Expression
- RNA Quantification
- Pathway Analysis

## Optional Supplements

- `pydeseq2`
