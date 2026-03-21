# Structural Biology Technical Reference

## Source Selection

### Use AlphaFold DB when

- the target has a UniProt accession
- a predicted structure is acceptable
- the goal is rapid structure-guided interpretation

### Use a prediction workflow instead when

- the sequence is novel or designed
- no AlphaFold DB entry exists

## Confidence Interpretation

### pLDDT

- `> 90`: highly reliable local geometry
- `70-90`: generally useful backbone confidence
- `50-70`: low confidence
- `< 50`: often disordered or not structurally reliable

### PAE

- low PAE means relative positions are trustworthy
- high PAE means domain orientation may be uncertain even if local folds look good

## Common Failure Modes

- high pLDDT within domains but high inter-domain PAE
  - local folds may be fine but domain arrangement is uncertain
- residue numbering mismatch
  - mutation or site mapping becomes wrong even if the structure file is correct
