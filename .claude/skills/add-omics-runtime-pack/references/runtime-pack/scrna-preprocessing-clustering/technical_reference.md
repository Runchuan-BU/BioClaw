# scRNA Preprocessing And Clustering Technical Reference

## Purpose

Use this file when the main skill is not enough to choose thresholds or handle nonstandard inputs.

## Input Branching

### Raw 10x droplet data

- Start with raw counts.
- Calculate QC before normalization.
- Use droplet-aware cutoffs and consider ambient RNA correction only if contamination is obvious.

### Existing `h5ad`

- Inspect:
  - `adata.raw`
  - `adata.layers`
  - existing embeddings in `adata.obsm`
  - cluster columns in `adata.obs`
- Avoid rerunning normalization if the object already stores processed values and raw counts separately.

### Multi-sample merged object

- Keep `sample_id` and `batch` columns.
- Filter within sample if one sample is much lower quality than the others.
- Do not use a single hard upper gene cutoff across all samples if chemistry differs.

## Threshold Heuristics

### Common first-pass thresholds

| Metric | Typical starting range | Notes |
|---|---:|---|
| `min_genes` | 200-500 | Raise for high-depth data |
| `max_genes` | 5000-8000 | Helps catch doublets, assay-dependent |
| `pct_counts_mt` | < 10-20% | Tissue- and assay-dependent |
| `min_cells per gene` | 3-10 | Higher for larger cohorts |
| HVGs | 2000-4000 | 3000 is a common default |
| PCs | 20-50 | Depends on cohort size and complexity |
| neighbors | 10-30 | Smaller for cleaner manifolds |

### Nucleus data

- Expect lower mitochondrial fraction.
- Expect lower genes per nucleus than whole-cell data.
- Avoid over-filtering low-RNA nuclei.

### Stressed or dissociated tissues

- Mito fraction may be elevated.
- Review hemoglobin or stress markers separately before discarding large fractions of cells.

## Recommended Plot Set

- QC violin for `n_genes_by_counts`, `total_counts`, `pct_counts_mt`
- scatter of `total_counts` vs `n_genes_by_counts`
- PCA variance ratio
- UMAP colored by sample, batch, QC metrics, and cluster

## Failure Modes

- UMAP mostly tracks `pct_counts_mt`
  - likely under-filtered low-quality cells
- clusters split by batch only
  - integration or batch-aware modeling is needed
- every cluster has very similar markers
  - clustering may be too fine or PCs poorly chosen

## Export Guidance

Minimum recommended files:

- `results/processed.h5ad`
- `results/cluster_assignments.tsv`
- `qc/filter_summary.tsv`
- `figures/qc_violin.pdf`
- `figures/umap_by_batch.pdf`
