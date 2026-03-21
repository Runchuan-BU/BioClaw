# Differential Expression Commands And Thresholds

## PyDESeq2 Example

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
res = stats.results_df

res.to_csv("results/de_results.tsv", sep="\t")
sig = res[(res["padj"] < 0.05) & (res["log2FoldChange"].abs() >= 1)]
sig.to_csv("results/de_significant.tsv", sep="\t")
res.sort_values("stat", ascending=False).to_csv("results/de_ranked_genes.tsv", sep="\t")
```

## Recommended Thresholds

- `padj < 0.05`
- `abs(log2FoldChange) >= 1`
- minimum replicates per group: `2`
- preferred replicates per group: `3`

## Output Convention

```text
results/
├── de_results.tsv
├── de_significant.tsv
└── de_ranked_genes.tsv
figures/
├── sample_pca.pdf
├── volcano.pdf
└── ma_plot.pdf
```
