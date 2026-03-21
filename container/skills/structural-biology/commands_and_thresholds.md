# Structural Biology Commands And Thresholds

## AlphaFold DB Retrieval With Biopython

```python
from Bio.PDB import alphafold_db

pred = next(alphafold_db.get_predictions("P00520"))
cif_path = alphafold_db.download_cif_for(pred, directory="results/structures")
```

## Direct API Query

```python
import requests

resp = requests.get("https://alphafold.ebi.ac.uk/api/prediction/P00520")
data = resp.json()
print(data[0]["entryId"])
print(data[0]["cifUrl"])
print(data[0]["pdbUrl"])
```

## Confidence Thresholds

- pLDDT `> 90`: very high confidence
- pLDDT `70-90`: usable backbone confidence
- pLDDT `< 50`: likely unreliable or disordered
- PAE `< 5 Å`: confident relative positioning
- PAE `> 15 Å`: relative orientation uncertain

## Output Convention

```text
results/
├── structures/
│   ├── AF-<accession>-model_v4.cif
│   └── AF-<accession>-model_v4.pdb
└── confidence/
    ├── AF-<accession>-confidence_v4.json
    └── AF-<accession>-predicted_aligned_error_v4.json
figures/
└── AF-<accession>-pae.png
```
