---
name: query-genomic-intelligence
description: Predict regulatory features, gene structure, and expression directly from DNA sequence using Genomic Intelligence's hosted transformer DNA models — no local GPU. Use when the user has a gene symbol, genomic region, or DNA/FASTA sequence and wants promoter, splice-site, enhancer, chromatin, expression (log TPM), or de-novo gene annotation predictions. Triggers on "genomic intelligence", "promoter prediction", "splice site", "enhancer activity", "chromatin state", "expression from sequence", "log TPM", "gene annotation", "DNA language model", "genomicintelligence.ai".
---

# Genomic Intelligence — DNA Sequence Models

Genomic Intelligence (GI) serves transformer DNA language models over six
sequence-analysis tasks on managed GPUs. Give it a **gene symbol**, a **genomic
region**, or a **DNA/FASTA sequence**; it returns structured predictions.
Nothing runs locally — no model weights, no GPU. It is a thin client over a
hosted, versioned inference API.

Docs: https://docs.genomicintelligence.ai · REST contract at
https://api.genomicintelligence.ai/v1/openapi.json · hosted MCP server at
`https://mcp.genomicintelligence.ai/mcp`.

> For research and development use, **not clinical or diagnostic decisions**.

## When to Use

Use GI when the user has DNA and wants a model prediction:

- **promoter** — promoter regions in a genomic region (sliding window)
- **splice** — donor/acceptor splice sites
- **enhancer** — developmental & housekeeping enhancer activity (DeepSTARR)
- **chromatin** — chromatin state across hundreds of tracks (DeepSEA)
- **expression** — sequence-to-expression, log(TPM+1), with a cell-type context
- **annotation** — de-novo gene/transcript annotation (async)
- **composite** — find the genes in a region and predict each one's expression

Not for local alignment, variant calling, or file I/O — use a local tool
(BioPython, bcftools) for those. GI is for **model inference from sequence**.

## Access and Authentication

- The **hosted MCP server** (`https://mcp.genomicintelligence.ai/mcp`, Streamable
  HTTP) works **keyless** against a capped public demo quota — prefer it on hosts
  that support MCP. An optional `gi_` bearer key raises the quota.
- The **REST `/v1` API requires** a `GI_API_KEY` (a `gi_` bearer), sent as
  `Authorization: Bearer <key>`. Request one at contact@genomicintelligence.ai.
- **Never hardcode the key.** Read it from the `GI_API_KEY` environment variable.

```bash
export GI_API_KEY="gi_yourkeyhere"     # optional for MCP; required for REST
```

## The Six Tasks

All REST tasks share one shape: `POST /v1/tasks/{task}/predict` with body
`{sequence, sequence_name, model?, options?}`, returning a `{data, meta}`
envelope.

| Task | Mode | Length bound | Notes |
|---|---|---|---|
| `promoter` | sync | 1–500,000 bp | sliding-window promoter regions |
| `splice` | sync | 1–500,000 bp | donor/acceptor sites (BigBird) |
| `enhancer` | sync | 1–500,000 bp | dev + housekeeping (DeepSTARR, *Drosophila*) |
| `chromatin` | sync | 1–500,000 bp | hundreds of tracks (DeepSEA) |
| `expression` | sync | **exactly 9,198 bp** | log(TPM+1); needs a cell-type `description` |
| `annotation` | **async** | 1–500,000 bp | de-novo transcripts; submit + poll |

Two hard rules the model enforces:

- **`expression` needs exactly 9,198 bp**, centred on the TSS (2 × 4,599). Any
  other length is rejected — build it from the canonical transcript's TSS, don't
  truncate by hand.
- **`expression` needs `options.description`** — a cell-type / assay string
  (e.g. `"K562 cells"`).

**Omit `model` and the API uses the task's default** — that is the recommended
call. Default model IDs are intentionally **not** documented here: defaults change
and retired IDs fail hard, so never hardcode one. To pin a model, or to pick a
non-human one (Drosophila, yeast, and Arabidopsis models exist for several tasks —
match the species), discover IDs at call time with `GET /v1/tasks/{task}/models`
(REST) or `list_models` (MCP). **Never invent a model ID.**

## How to Execute (REST)

Sync tasks (promoter, splice, enhancer, chromatin, expression) are one call:

```python
import os, requests

BASE = os.environ.get("GI_BASE_URL", "https://api.genomicintelligence.ai")
HEADERS = {"Authorization": f"Bearer {os.environ['GI_API_KEY']}"}

def gi_predict(task, sequence, sequence_name, model=None, options=None):
    body = {"sequence": sequence, "sequence_name": sequence_name}
    if model:   body["model"] = model
    if options: body["options"] = options
    r = requests.post(f"{BASE}/v1/tasks/{task}/predict", headers=HEADERS, json=body)
    r.raise_for_status()          # 400 invalid; 401 no/bad key; 413 too long; 429 rate limit
    return r.json()               # {"data": {...}, "meta": {...}}

# Promoter:
out = gi_predict("promoter", seq, "TP53_region")
print(out["data"]["summary"])

# Expression — exactly 9,198 bp + a cell-type description:
out = gi_predict("expression", tss_window_9198bp, "HBB",
                 options={"description": "K562 cells"})
print(out["data"]["prediction"]["expression_log_tpm"])
```

Async (`annotation`) is submit-then-poll — send `Prefer: respond-async`, get a
`job_id`, then poll `GET /v1/tasks/jobs/{job_id}` until it returns `200` (a `202`
means still running):

```python
import time
r = requests.post(f"{BASE}/v1/tasks/annotation/predict",
                  headers={**HEADERS, "Prefer": "respond-async"},
                  json={"sequence": seq, "sequence_name": "TP53"})
r.raise_for_status()
job_id = r.json()["data"]["job_id"]
while True:
    j = requests.get(f"{BASE}/v1/tasks/jobs/{job_id}", headers=HEADERS)
    if j.status_code == 200: break
    j.raise_for_status(); time.sleep(5)
transcripts = j.json()["data"]["transcripts"]
```

## Sequence Acquisition

You rarely start from a raw sequence. Fetch reference sequence from **Ensembl
REST** (`rest.ensembl.org`, public, no key) for a gene symbol or region, then
feed it to GI. For `expression`, build the **exactly 9,198 bp TSS-centred window**
from the gene's canonical transcript (`expand=1`): 4,599 bp upstream + 4,598 bp
downstream on the gene's strand. Default species is **human, GRCh38**; use the
Ensembl production name for others (`mus_musculus`, `drosophila_melanogaster`).

## Hosted MCP (keyless, preferred on MCP hosts)

Acquire a **sequence handle** (`sequence_ref`), then predict against it, so large
sequences never enter the context:

```
load_demo_sequence()                      # keyless smoke test -> handle
fetch_ensembl_sequence(region="TP53")     # gene or region -> handle
fetch_gene_for_expression(gene="HBB")     # TSS-centred 9,198 bp handle
predict_promoter(sequence_ref=<ref>)      # + predict_splice/_enhancer/_chromatin
predict_expression(sequence_ref=<ref>, description="K562 cells")
find_genes_and_predict_expression(region=..., description=...)   # composite
```

`annotation` is async on MCP too: submit, then `get_job(job_id)` until terminal.
Reference context lives in the `gi://models`, `gi://docs/tasks`, and
`gi://account` MCP resources.

## Key Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/tasks/{task}/predict` | Run a task (add `Prefer: respond-async` for annotation) |
| GET | `/v1/tasks/jobs/{job_id}` | Poll an async job (202 running → 200 terminal) |
| GET | `/v1/tasks/{task}/models` | List available model IDs for a task |

## Notes

- Errors: `400` invalid (expression must be exactly 9,198 bp + `description`),
  `401` missing/invalid key (REST), `413` too long (≤500,000 bp), `429` rate cap
  (back off / ask GI to raise the tier), `5xx` retry.
- GI is a hosted service; nothing here ships weights or runs local inference.

## Follow-up Suggestions

- For "what genes are here and how are they expressed?", use the composite.
- To explore available models per task, call `list_models` / `GET .../models`
  before predicting.
