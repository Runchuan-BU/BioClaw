---
name: cell-annotation
description: Automated and marker-guided single-cell cell type annotation using CellTypist, marker review, reference transfer, and confidence-aware label curation.
tool_type: python
primary_tool: CellTypist
---

# Cell Annotation

## Version Compatibility

Reference examples assume:

- `scanpy` 1.10+
- `celltypist` 1.6+
- `pandas` 2.2+

Before using code patterns, verify installed versions match the environment:

- Python: `python -c "import scanpy, celltypist; print(scanpy.__version__, celltypist.__version__)"`
- If APIs differ, inspect the installed docs and adapt the pattern instead of retrying unchanged.

## Overview

Use this skill when the user wants cluster labels or per-cell labels for scRNA-seq. The default stance is:

1. inspect markers first
2. run reference-based annotation
3. keep uncertainty explicit
4. export both raw predicted labels and a curated final label column

## When To Use This Skill

- clusters already exist and need biological labels
- the dataset has a relevant reference atlas or known marker panels
- the user wants CellTypist or similar automated annotation

## Quick Route

- If clusters are unstable or clearly QC-driven, fix preprocessing before annotation.
- If the atlas mismatch is severe, prefer broad lineage labels over overconfident fine labels.
- If multiple methods disagree, mark labels as uncertain instead of forcing a consensus.

## Progressive Disclosure

- Read [technical_reference.md](technical_reference.md) for strategy selection, confidence interpretation, and disagreement handling.
- Read [commands_and_thresholds.md](commands_and_thresholds.md) for concrete CellTypist code, score thresholds, and output columns.

## Default Rules

- Never accept automated labels without checking marker expression.
- Keep per-cell predictions and cluster-level curated labels separate.
- Use `Unknown`, `Uncertain`, or `Ambiguous` when evidence is weak.
- Document the reference model or atlas used.

## Expected Inputs

- processed `h5ad` with clusters and embeddings
- marker gene lists or known lineage markers
- optional reference atlas or model

## Expected Outputs

- `results/annotated.h5ad`
- `results/cell_labels.tsv`
- `results/cluster_annotation_summary.tsv`
- `figures/umap_cell_types.pdf`
- `figures/marker_dotplot.pdf`

## Preferred Tools

- `scanpy`
- `celltypist`
- `pandas`
- `matplotlib`

## Starter Pattern

```python
import scanpy as sc
import celltypist

adata = sc.read_h5ad("results/processed.h5ad")
pred = celltypist.annotate(adata, model="Immune_All_Low.pkl", majority_voting=True)
adata = pred.to_adata()
adata.obs["cell_type_raw"] = adata.obs["majority_voting"]
adata.obs["cell_type_confidence"] = adata.obs["conf_score"]
adata.write("results/annotated.h5ad")
```

## Workflow

### 1. Inspect markers before automation

Check canonical lineage markers on UMAP, dotplots, or heatmaps. If clusters do not support a plausible biological separation, do not lock in labels yet.

### 2. Choose the annotation level

- broad lineage labels when the reference is imperfect
- fine-grained labels only when markers and reference agree
- cluster-level labels for noisy or sparse datasets

### 3. Run reference-based annotation

Use CellTypist or another compatible reference transfer method. Store:

- raw label
- confidence score
- model name

### 4. Curate with markers and cluster context

Review top markers per cluster and compare them against predicted labels. Rename or collapse labels if fine categories are not robust.

### 5. Export both raw and final labels

At minimum, keep:

- `cell_type_raw`
- `cell_type_confidence`
- `cell_type_final`

## Output Artifacts

- `results/annotated.h5ad`
- `results/cell_labels.tsv`
- `results/cluster_annotation_summary.tsv`
- `figures/umap_cell_types.pdf`
- `figures/marker_dotplot.pdf`

## Quality Review

- `CellTypist conf_score > 0.5` is usually comfortable for a provisional label.
- `0.2-0.5` should be manually reviewed against markers.
- `< 0.2` should usually remain `Unknown` or `Uncertain` unless markers are compelling.
- Every final label should have either marker support, reference support, or both.

## Anti-Patterns

- assigning fine-grained labels only because the model returned them
- overwriting raw labels so the original prediction is lost
- treating low-confidence single-cell labels as publication-ready without review
- hiding disagreements between marker evidence and reference transfer

## Related Skills

- scRNA Preprocessing And Clustering
- Cell Communication
- Trajectory And Lineage

## Optional Supplements

- `scanpy`
- `scvi-tools`
