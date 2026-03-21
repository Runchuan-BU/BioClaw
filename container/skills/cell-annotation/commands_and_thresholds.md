# Cell Annotation Commands And Thresholds

## CellTypist Example

```python
import scanpy as sc
import celltypist

adata = sc.read_h5ad("results/processed.h5ad")
model = "Immune_All_Low.pkl"
pred = celltypist.annotate(adata, model=model, majority_voting=True)
adata = pred.to_adata()

adata.obs["cell_type_raw"] = adata.obs["majority_voting"]
adata.obs["cell_type_confidence"] = adata.obs["conf_score"]

adata.obs["cell_type_final"] = adata.obs["cell_type_raw"]
adata.obs.loc[adata.obs["cell_type_confidence"] < 0.2, "cell_type_final"] = "Unknown"

adata.write("results/annotated.h5ad")
adata.obs[["cell_type_raw", "cell_type_confidence", "cell_type_final"]].to_csv(
    "results/cell_labels.tsv",
    sep="\t",
)
```

## Plot Set

```python
sc.pl.umap(adata, color=["leiden_r05", "cell_type_final", "cell_type_confidence"], save="_cell_types.pdf")
sc.pl.dotplot(adata, marker_dict, groupby="cell_type_final", save="_marker_dotplot.pdf")
```

## Threshold Defaults

- high-confidence provisional label: `conf_score > 0.5`
- manual review zone: `0.2-0.5`
- default unknown zone: `< 0.2`

## Output Convention

```text
results/
├── annotated.h5ad
├── cell_labels.tsv
└── cluster_annotation_summary.tsv
figures/
├── umap_cell_types.pdf
└── marker_dotplot.pdf
```
