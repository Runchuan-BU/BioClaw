---
name: structural-biology
description: Structure retrieval, confidence-aware AlphaFold DB usage, coordinate download, PAE and pLDDT interpretation, and structure-guided biological annotation.
tool_type: python
primary_tool: AlphaFold DB
---

# Structural Biology

## Version Compatibility

Reference examples assume:

- `biopython` 1.84+
- AlphaFold DB public API current format
- optional visualization stack such as `py3Dmol` or PyMOL

Verify before use:

- Python: `python -c "import Bio; print(Bio.__version__)"`

## Overview

Use this skill when the task is:

- retrieving AlphaFold-predicted structures by UniProt accession
- downloading coordinate and confidence files
- reading pLDDT or PAE to judge confidence
- mapping sequence findings onto structure

## When To Use This Skill

- a UniProt accession or known protein target exists
- experimental structure is absent or incomplete
- the user needs confidence-aware structural interpretation

## Quick Route

- known UniProt accession: query AlphaFold DB first
- novel designed sequence without AlphaFold DB entry: use a separate prediction workflow such as ColabFold
- structure interpretation request: always inspect pLDDT and PAE before making mechanistic claims

## Progressive Disclosure

- Read [technical_reference.md](technical_reference.md) for confidence interpretation and source-selection rules.
- Read [commands_and_thresholds.md](commands_and_thresholds.md) for AlphaFold DB retrieval patterns, URL layouts, and file conventions.

## Expected Inputs

- UniProt accession or sequence context
- optional residue list, mutation list, or ligand site hypothesis

## Expected Outputs

- `results/structures/AF-<accession>.cif`
- `results/structures/AF-<accession>.pdb`
- `results/confidence/AF-<accession>-confidence.json`
- `results/confidence/AF-<accession>-pae.json`
- `figures/AF-<accession>-pae.png`

## Starter Pattern

```python
from Bio.PDB import alphafold_db

prediction = next(alphafold_db.get_predictions("P00520"))
cif_path = alphafold_db.download_cif_for(prediction, directory="results/structures")
print(cif_path)
```

## Confidence Thresholds

### pLDDT

| pLDDT | Interpretation |
|---|---|
| `> 90` | very high confidence |
| `70-90` | good backbone confidence |
| `50-70` | low confidence |
| `< 50` | likely disorder or unreliable local structure |

### PAE

| PAE | Interpretation |
|---|---|
| `< 5 Å` | confident relative positioning |
| `5-15 Å` | moderate uncertainty |
| `> 15 Å` | domain orientation may be unreliable |

## Workflow

### 1. Choose the structure source

- experimental structure if available and suitable
- AlphaFold DB for known proteins with UniProt accessions
- separate prediction workflow for novel sequences

### 2. Retrieve coordinates and confidence files

Download:

- `mmCIF` or `PDB`
- confidence JSON
- PAE JSON

### 3. Inspect confidence before interpretation

Do not map mutations or infer interfaces from low-confidence regions without saying so.

### 4. Annotate the biological question

Map domains, active sites, mutations, motifs, or interfaces onto the structure.

### 5. Export reusable artifacts

Save coordinates, confidence files, and a PAE heatmap or equivalent summary.

## Output Artifacts

```text
results/
├── structures/
│   ├── AF-P00520-F1-model_v4.cif
│   └── AF-P00520-F1-model_v4.pdb
└── confidence/
    ├── AF-P00520-F1-confidence_v4.json
    └── AF-P00520-F1-predicted_aligned_error_v4.json
figures/
└── AF-P00520-F1-pae.png
```

## Quality Review

- pLDDT must be reviewed before claiming local residue geometry is trustworthy
- PAE must be reviewed before claiming domain-domain arrangement is trustworthy
- residue numbering and chain mapping must be checked before mutation interpretation
- low-confidence or disordered regions should be labeled explicitly

## Anti-Patterns

- treating every AlphaFold region as equally reliable
- ignoring PAE when discussing domain orientation
- mapping variants onto mismatched residue numbering
- using AlphaFold DB retrieval as if it were de novo prediction for novel sequences

## Related Skills

- Proteomics
- Pathway Analysis

## Optional Supplements

- `alphafold-database`
