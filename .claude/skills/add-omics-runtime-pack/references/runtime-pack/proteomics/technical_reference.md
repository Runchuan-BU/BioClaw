# Proteomics Technical Reference

## Assay Branching

### DDA

- identification completeness may be lower
- missingness often needs careful handling

### DIA

- often more complete matrices
- still review batch and library effects

### PTM-enriched

- do not interpret as global proteome abundance
- keep PTM site-level results separate from protein-level abundance

## QC Thresholds

| Metric | Rule of thumb |
|---|---|
| overall missingness | `< 30%` preferred |
| technical replicate correlation | `> 0.9` |
| biological replicate correlation | usually `> 0.8` |

## Failure Modes

- one sample has much higher missingness
  - likely technical outlier
- strong group separation but also strong batch separation
  - revisit normalization and design
- peptide and protein tables disagree strongly
  - check aggregation and protein inference assumptions
