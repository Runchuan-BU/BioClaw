# scRNA Preprocessing And Clustering Commands And Thresholds

## Canonical Scanpy Flow

```python
import scanpy as sc

adata = sc.read_h5ad("input.h5ad")
adata.var_names_make_unique()
adata.var["mt"] = adata.var_names.str.upper().str.startswith("MT-")
sc.pp.calculate_qc_metrics(adata, qc_vars=["mt"], inplace=True)

sc.pl.violin(
    adata,
    ["n_genes_by_counts", "total_counts", "pct_counts_mt"],
    jitter=0.4,
    multi_panel=True,
    save="_qc_violin.pdf",
)

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

sc.pp.highly_variable_genes(adata, flavor="seurat_v3", n_top_genes=3000)
adata = adata[:, adata.var["highly_variable"]].copy()
sc.pp.scale(adata, max_value=10)
sc.tl.pca(adata, svd_solver="arpack")
sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30)
sc.tl.umap(adata)

for res in [0.2, 0.5, 0.8, 1.0]:
    sc.tl.leiden(adata, resolution=res, key_added=f"leiden_{res}")

adata.write("results/processed.h5ad")
```

## Threshold Defaults

- `min_genes`: `200`
- `max_genes`: `6000`
- `pct_counts_mt`: `15`
- `n_top_genes`: `3000`
- `n_neighbors`: `15`
- `n_pcs`: `30`
- first-pass Leiden resolution: `0.5`

## Output Convention

```text
results/
├── processed.h5ad
├── cluster_assignments.tsv
qc/
├── filter_summary.tsv
├── cell_qc_metrics.tsv
figures/
├── qc_violin.pdf
├── pca_variance_ratio.pdf
└── umap_leiden_0.5.pdf
```
