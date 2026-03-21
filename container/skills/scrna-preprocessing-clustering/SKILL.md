---
name: scrna-preprocessing-clustering
description: Standard scRNA-seq preprocessing and clustering with Scanpy. Use for QC, normalization, HVG selection, PCA, neighbor graph construction, UMAP, Leiden clustering, and export of an analysis-ready AnnData object.
tool_type: python
primary_tool: scanpy
---

# scRNA Preprocessing And Clustering

## Version Compatibility

Reference examples assume:

- `scanpy` 1.10+
- `anndata` 0.10+
- `pandas` 2.2+
- `matplotlib` 3.8+

Before using code patterns, verify installed versions match the environment:

- Python: `python -c "import scanpy, anndata; print(scanpy.__version__, anndata.__version__)"`
- If signatures differ, inspect the installed API and adapt the pattern instead of retrying unchanged.

## Overview

Use this skill to turn raw or minimally processed scRNA-seq data into an analysis-ready object with:

- QC-filtered cells and genes
- normalized expression values
- highly variable genes
- PCA and UMAP embeddings
- Leiden clusters
- saved `h5ad` artifact for annotation, DE, integration, or trajectory analysis

## When To Use This Skill

- raw 10x matrices, filtered count matrices, or `h5ad` inputs need standard preprocessing
- the user wants UMAP, clustering, or marker discovery
- downstream tasks depend on a stable single-cell object rather than ad hoc plots

## Quick Route

- If the input is already a processed `h5ad`, inspect `adata.raw`, embeddings, cluster columns, and QC columns before rerunning preprocessing.
- If the input is raw counts, do QC first and only normalize after filtering obvious low-quality cells.
- If multiple batches are present, preprocess cleanly first, then consider integration instead of hiding batch effects with aggressive filtering.

## Progressive Disclosure

- Read [technical_reference.md](technical_reference.md) for QC decision rules, assay caveats, and integration branching.
- Read [commands_and_thresholds.md](commands_and_thresholds.md) for concrete Scanpy code, default thresholds, and output conventions.

## Default Rules

- Keep raw counts recoverable. Prefer `adata.raw = adata.copy()` before regression or scaling.
- Report thresholds explicitly. Do not silently drop cells or genes.
- Show QC distributions before applying hard filters.
- Use vector outputs such as `.pdf` or `.svg` for final figures when possible.

## Expected Inputs

- 10x directory, `.h5`, `.h5ad`, or count matrix
- cell metadata if available
- species context for mitochondrial or ribosomal gene detection

## Expected Outputs

- `results/processed.h5ad`
- `qc/cell_qc_metrics.tsv`
- `qc/gene_qc_metrics.tsv`
- `figures/qc_violin.pdf`
- `figures/pca_variance_ratio.pdf`
- `figures/umap_leiden.pdf`

## Preferred Tools

- `scanpy`
- `anndata`
- `pandas`
- `matplotlib`
- `seaborn`

## Starter Pattern

```python
import scanpy as sc

adata = sc.read_10x_mtx("counts/")
adata.var_names_make_unique()
adata.var["mt"] = adata.var_names.str.upper().str.startswith("MT-")
sc.pp.calculate_qc_metrics(adata, qc_vars=["mt"], inplace=True)

adata = adata[
    (adata.obs["n_genes_by_counts"] >= 200)
    & (adata.obs["n_genes_by_counts"] <= 6000)
    & (adata.obs["pct_counts_mt"] < 15),
    :
].copy()

sc.pp.filter_genes(adata, min_cells=3)
sc.pp.normalize_total(adata, target_sum=1e4)
sc.pp.log1p(adata)
adata.raw = adata.copy()

sc.pp.highly_variable_genes(adata, n_top_genes=3000, flavor="seurat_v3")
adata = adata[:, adata.var["highly_variable"]].copy()
sc.pp.scale(adata, max_value=10)
sc.tl.pca(adata, svd_solver="arpack")
sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30)
sc.tl.umap(adata)
sc.tl.leiden(adata, resolution=0.5, key_added="leiden_r05")
adata.write("results/processed.h5ad")
```

## Workflow

### 1. Load and validate the object

- confirm orientation is cells by genes
- make gene names unique
- record sample IDs and batch labels before merging or filtering

### 2. Compute QC metrics and inspect distributions

- `n_genes_by_counts`
- `total_counts`
- `pct_counts_mt`
- optional ribosomal or hemoglobin fractions

Plot distributions before filtering. Thresholds vary by chemistry, tissue, and nucleus versus whole-cell assay.

### 3. Filter cells and genes

Use dataset-aware thresholds. Good first-pass defaults:

- `min_genes >= 200`
- `max_genes <= 5000-8000` to remove likely doublets in many droplet datasets
- `pct_counts_mt < 10-20` depending on tissue stress
- `min_cells >= 3` for genes

### 4. Normalize, log-transform, and select HVGs

- normalize with `target_sum=1e4`
- `log1p`
- select `2000-4000` HVGs
- save raw counts before heavy transformations

### 5. Reduce dimensions and cluster

- PCA on HVGs
- neighbor graph using `10-30` PCs and `10-30` neighbors as a starting range
- UMAP for visualization
- Leiden across a small resolution grid such as `0.2`, `0.5`, `0.8`, `1.0`

### 6. Export analysis-ready artifacts

Always save:

- processed `h5ad`
- QC tables
- cluster assignments
- publication-ready QC and UMAP figures

## Output Artifacts

- `results/processed.h5ad`: main reusable AnnData object
- `results/cluster_assignments.tsv`: barcode plus cluster labels
- `qc/filter_summary.tsv`: counts before and after filtering
- `figures/umap_leiden.pdf`: main embedding figure

## Quality Review

- Median genes per cell should be plausible for the chemistry and tissue.
- Mitochondrial fraction should not dominate retained cells.
- PCA variance should decay smoothly rather than showing obvious technical axes only.
- UMAP should be reviewed together with QC metrics and batch labels, not alone.
- Cluster labels should not be finalized before marker inspection.

## Anti-Patterns

- reprocessing an already integrated object as if it were raw counts
- using a single universal mitochondrial threshold for every tissue
- interpreting UMAP separation as biology before checking batch and QC covariates
- discarding raw counts needed later for DE or pseudobulk

## Related Skills

- Cell Annotation
- Cell Communication
- Trajectory And Lineage
- Multiome And scATAC

## Optional Supplements

- `anndata`
- `scanpy`
