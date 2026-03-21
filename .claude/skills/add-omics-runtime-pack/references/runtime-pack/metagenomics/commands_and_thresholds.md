# Metagenomics Commands And Thresholds

## QC And Taxonomy

```bash
fastp \
  -i sample_R1.fastq.gz \
  -I sample_R2.fastq.gz \
  -o qc/sample.clean.R1.fastq.gz \
  -O qc/sample.clean.R2.fastq.gz \
  --html qc/sample.fastp.html \
  --json qc/sample.fastp.json

kraken2 \
  --db $KRAKEN_DB \
  --paired qc/sample.clean.R1.fastq.gz qc/sample.clean.R2.fastq.gz \
  --report results/taxonomy/sample.kraken.report \
  --output results/taxonomy/sample.kraken.out \
  --confidence 0.1
```

## Bracken Refinement

```bash
bracken \
  -d $KRAKEN_DB \
  -i results/taxonomy/sample.kraken.report \
  -o results/taxonomy/sample.bracken.species.tsv \
  -r 150 \
  -l S
```

## Common Defaults

- `kraken2 --confidence 0.1` as a practical first pass
- report retained reads after QC and after host depletion
- do not emphasize taxa with vanishing abundance without a reason

## Output Convention

```text
results/
├── taxonomy/
│   ├── sample.kraken.report
│   ├── sample.bracken.species.tsv
│   └── bracken_species.tsv
├── function/pathabundance.tsv
└── amr/amr_summary.tsv
qc/
└── read_processing_summary.tsv
```
