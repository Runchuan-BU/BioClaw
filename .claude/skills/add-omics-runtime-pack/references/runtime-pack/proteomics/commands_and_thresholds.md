# Proteomics Commands And Thresholds

## Protein Table Loading

```python
import pandas as pd

protein_df = pd.read_csv("protein_groups.tsv", sep="\t")
sample_cols = [c for c in protein_df.columns if c.startswith("LFQ intensity")]
matrix = protein_df[sample_cols].replace(0, pd.NA)
```

## QC Defaults

- overall missingness: `< 30%`
- technical replicate correlation: `> 0.9`
- biological replicate correlation: `> 0.8`

## Output Convention

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
