# ATAC Seq Commands And Thresholds

## Peak Calling

```bash
macs3 callpeak \
  -t atac.bam \
  -f BAMPE \
  -g hs \
  -n sample \
  --nomodel \
  --shift -100 \
  --extsize 200 \
  -q 0.01 \
  --outdir results/peaks
```

## Suggested QC Gates

- uniquely mapped reads: `>= 20M`
- TSS enrichment: `> 7`
- strong TSS enrichment: `> 10`
- FRiP: `> 0.2`

## Output Convention

```text
results/
├── peaks/sample_peaks.narrowPeak
├── matrix/consensus_peak_counts.tsv
└── diff_accessibility.tsv
qc/
├── tss_enrichment.tsv
└── fragment_metrics.tsv
```
