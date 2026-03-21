# ATAC Seq Technical Reference

## QC Interpretation

### TSS Enrichment

| TSS enrichment | Interpretation |
|---|---|
| `< 5` | poor |
| `5-7` | weak |
| `> 7` | acceptable |
| `> 10` | strong |

### FRiP

| FRiP | Interpretation |
|---|---|
| `< 0.1` | weak |
| `0.1-0.2` | usable |
| `> 0.2` | strong |

## Why ATAC Uses Different Peak Settings

ATAC libraries often use:

- `--nomodel`
- `--shift -100`
- `--extsize 200`

because transposition footprints differ from ChIP fragment modeling assumptions.

## Failure Modes

- weak TSS enrichment and no periodicity
  - likely poor library quality
- many peaks but poor FRiP
  - likely noisy open chromatin signal
- footprinting requested on shallow data
  - report that confidence is low before proceeding
