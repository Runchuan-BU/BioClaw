# Differential Expression Technical Reference

## Design Checks

Verify before fitting:

- each contrast group has at least 2 replicates
- batch is not perfectly confounded with condition
- paired samples are encoded explicitly
- factor reference level is correct

## Default Reporting Thresholds

| Metric | Common default |
|---|---:|
| adjusted p-value | `< 0.05` |
| absolute log2 fold-change | `>= 1` |

Do not claim these are universal. Tighten or loosen only with justification.

## Ranked Gene Export

For enrichment, export either:

- all genes ranked by Wald statistic
- all genes ranked by signed log2 fold-change with significance columns retained

## Failure Modes

- no significant genes and PCA shows weak separation
  - likely biology is subtle or the design is underpowered
- many significant genes but batch drives PCA
  - model specification or batch handling needs review
