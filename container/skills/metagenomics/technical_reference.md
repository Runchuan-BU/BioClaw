# Metagenomics Technical Reference

## Taxonomy Strategy

### `kraken2 + bracken`

Use when:

- you want a practical species or genus abundance table
- speed matters
- a broad classification database is available

### `MetaPhlAn`

Use when:

- marker-based profiling is preferred
- lower false-positive behavior is more important than broad k-mer sensitivity

## Host Depletion Guidance

For host-associated samples:

- remove host reads before abundance interpretation
- report pre- and post-depletion read counts
- if host reads dominate, say so clearly in the final summary

## Practical Cautions

- very low-abundance taxa are unstable
- database choice strongly changes taxonomic output
- strain tracking should not be claimed from simple species tables

## Minimum QC Reporting

- raw reads
- retained reads after QC
- retained reads after host depletion if used
- database version
