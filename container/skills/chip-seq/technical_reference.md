# ChIP Seq Technical Reference

## Narrow Versus Broad Marks

### Narrow marks

Examples:

- TF ChIP
- H3K4me3
- H3K27ac

Use standard narrow peak mode and start with:

- `-q 0.01`
- `-f BAMPE` for paired-end data

### Broad marks

Examples:

- H3K27me3
- H3K36me3
- H3K9me3

Use:

- `--broad`
- `--broad-cutoff 0.1`

## QC Priorities

- mapped unique reads
- duplication burden
- FRiP
- replicate concordance
- enrichment at biologically plausible loci

## Practical Thresholds

| Metric | Narrow mark guidance |
|---|---:|
| uniquely mapped reads | `>= 10M` |
| FRiP | `> 0.01` minimum, `> 0.05` better |
| replicates | `>= 2` preferred |

For broad marks, read depth generally needs to be higher and FRiP values are not directly comparable to TF ChIP.

## When To Escalate Review

- very few peaks despite high read depth
- extremely many peaks in nearly every region
- strong enrichment only in blacklist-like regions
- motif or annotation results that do not fit the biology at all
