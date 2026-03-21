# ChIP Seq Commands And Thresholds

## Narrow Peak Calling

```bash
macs3 callpeak \
  -t chip.bam \
  -c input.bam \
  -f BAMPE \
  -g hs \
  -n sample \
  -q 0.01 \
  --outdir results/peaks
```

## Broad Peak Calling

```bash
macs3 callpeak \
  -t chip.bam \
  -c input.bam \
  -f BAMPE \
  -g hs \
  -n sample_broad \
  --broad \
  --broad-cutoff 0.1 \
  --outdir results/peaks
```

## Signal Track Export

```bash
macs3 callpeak \
  -t chip.bam \
  -c input.bam \
  -f BAMPE \
  -g hs \
  -n sample \
  -B --SPMR \
  --outdir results/peaks

sort -k1,1 -k2,2n results/peaks/sample_treat_pileup.bdg > results/tracks/sample.sorted.bdg
bedGraphToBigWig results/tracks/sample.sorted.bdg chrom.sizes results/tracks/sample_treat_pileup.bw
```

## Default Thresholds

- narrow peak q-value: `0.01`
- fallback narrow peak q-value: `0.05`
- broad peak cutoff: `0.1`
- recommended unique mapped reads:
  - narrow: `>= 10M`
  - broad: `>= 20M`

## Output Convention

```text
results/
├── peaks/
│   ├── sample_peaks.narrowPeak or sample_broad_peaks.broadPeak
│   ├── sample_summits.bed
│   └── sample_model.r
├── tracks/
│   └── sample_treat_pileup.bw
qc/
└── chip_qc_summary.tsv
```
