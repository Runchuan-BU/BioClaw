---
name: query-genomic-intelligence
description: Predict regulatory features, gene structure, and expression directly from DNA sequence using Genomic Intelligence's hosted transformer DNA models - no local GPU. Use when the user has a gene symbol, genomic region, or DNA/FASTA sequence and wants promoter, splice-site, enhancer, chromatin, expression (log TPM), or de-novo gene annotation predictions. Triggers on "genomic intelligence", "promoter prediction", "splice site", "enhancer activity", "chromatin state", "expression from sequence", "log TPM", "gene annotation", "DNA language model", "genomicintelligence.ai".
---

# Genomic Intelligence - DNA Sequence Models

Genomic Intelligence (GI) serves transformer DNA language models over six
sequence-analysis tasks on managed GPUs. Give it a **gene symbol**, a **genomic
region**, or a **DNA/FASTA sequence**; it returns structured predictions.
Nothing runs locally - no model weights, no GPU. It is a thin client over a
hosted, versioned inference API.

Docs: https://docs.genomicintelligence.ai | REST contract at
https://api.genomicintelligence.ai/v1/openapi.json | hosted MCP server at
`https://mcp.genomicintelligence.ai/mcp`.

> Research and development use. Not for clinical or diagnostic decisions.

## When to Use

Use GI when the user has DNA and wants a model prediction:

- **promoter** - promoter regions in a genomic region (sliding window)
- **splice** - donor/acceptor splice sites
- **enhancer** - developmental & housekeeping enhancer activity (DeepSTARR)
- **chromatin** - chromatin state across hundreds of tracks (DeepSEA)
- **expression** - sequence-to-expression, log(TPM+1), with a cell-type context
- **annotation** - de-novo gene/transcript annotation (async recommended)
- **composite** - find the genes in a region and predict each one's expression

Not for local alignment, variant calling, or file I/O - use a local tool
(BioPython, bcftools) for those. GI is for **model inference from sequence**.

## Access and Authentication

- The **hosted MCP server** (`https://mcp.genomicintelligence.ai/mcp`, Streamable
  HTTP) works **keyless** against a rate- and concurrency-limited public demo
  tier - prefer it on hosts that support MCP. An optional `gi_` bearer key
  raises those limits.
- The **REST `/v1` API requires** a `GI_API_KEY` (a `gi_` bearer), sent as
  `Authorization: Bearer <key>`. Request one at contact@genomicintelligence.ai.
- **Never hardcode the key.** Read it from the `GI_API_KEY` environment variable.

```bash
export GI_API_KEY="gi_yourkeyhere"     # optional for MCP; required for REST
```

## The Six Tasks

Each task is **its own published operation** - `POST /v1/tasks/promoter/predict`,
`/v1/tasks/splice/predict`, `/v1/tasks/enhancer/predict`,
`/v1/tasks/chromatin/predict`, `/v1/tasks/annotation/predict`,
`/v1/tasks/expression/predict` - with its own request schema, its own minimum
length, and its own closed `options` object. There is no shared `PredictRequest`.
The URLs are the same strings clients already POST to, so no URL construction
changes. Body `{sequence, sequence_name?, model?, options?}`, returning a
`{data, meta}` envelope. `expression` is the strictest: alone among the six it
requires `options` too - see the rules below.

| Task | Recommended mode | Accepted length | `context_window_bp` | Notes |
|---|---|---|---|---|
| `promoter` | sync | 300-500,000 bp | 2,000 bp | sliding-window promoter regions |
| `splice` | sync | 100-500,000 bp | 15,000 bp | donor/acceptor sites (BigBird); strand-specific - feed transcript orientation |
| `enhancer` | sync | 50-500,000 bp | 249 bp | dev + housekeeping (DeepSTARR, *Drosophila*) |
| `chromatin` | sync | 200-500,000 bp | 1,000 bp | hundreds of tracks (DeepSEA) |
| `expression` | sync | **9,198-500,000 bp** | n/a (`trained_window_bp` 9,198) | log(TPM+1); needs `tss_index` unless exactly 9,198 bp, plus a cell-type `description` |
| `annotation` | async | 1,000-500,000 bp | n/a | de-novo transcripts; submit + poll |

`Recommended mode` is latency guidance, not a constraint - every task accepts
both. Omit `Prefer` for a synchronous `200`; send `Prefer: respond-async` for a
`202` plus `GET /v1/tasks/jobs/{job_id}`. Only the composite workflow enforces a
mode, rejecting sync above 50,000 bp with `413 sync_too_large`.

**The minimum is admission control, not a scoring regime.** A request above
the floor but shorter than the selected model's `bio_spec.context_window_bp`
is *accepted and scored* - against a window padded out to the context window. Enhancer is the
sharp case: the floor is 50 bp but the context window is
249 bp, so 50-248 bp is scored mostly on padding. Compare your length against
`context_window_bp` from `GET /v1/tasks/{task}/models` to know whether the model
saw real sequence. Longer input is fine - the scanner steps a prediction window
at a time and pads only the final partial window.

Under the floor **and over the 500,000 bp cap** are both `422 validation_failed`
at `loc ["body","sequence"]` - over-length is *not* a `413`. All lengths are
measured after whitespace is stripped, so a line-wrapped FASTA body pastes
verbatim (a `>` header line still fails the alphabet check).

`options` is typed and **closed** (`additionalProperties: false`) per task - an
unknown key is a hard `422` (`type: "extra_forbidden"`), never ignored: promoter
`threshold`; splice `threshold`, `site_types`; enhancer none; chromatin
`threshold`; annotation `batch_size`, `shift_coordinates`,
`reverse_complement`; expression `description` (required, and the only key).

Three hard rules the API enforces for `expression` (every violation is a `422`;
nothing is padded, clamped, or truncated, and there is no opt-out flag):

- **The model always scores exactly one 9,198 bp TSS-centred window** -
  `sequence[tss_index-4599 : tss_index+4599]`. The endpoint accepts
  **9,198-500,000 bp**; below 9,198 bp is a hard `422`.
- **`tss_index` is required unless the sequence is exactly 9,198 bp.** It is the
  0-based TSS offset into the **whitespace-stripped** sequence, and must satisfy
  `4599 <= tss_index <= len(sequence) - 4599`. At exactly 9,198 bp it defaults to
  4,599 - the only legal value there. Hand over a whole locus (up to 500 kb) plus
  a `tss_index` and the server cuts the window for you; it does **not** discover
  the TSS itself, and it does **not** reverse-complement - submit gene-sense.
- **`options.description`** - a cell-type / assay string (e.g. `"K562 cells"`) -
  is required, and is the *only* key `expression` accepts inside `options`.
  Unknown top-level body fields are also rejected.

> Trap: the legal `tss_index` range is wide, so a *wrong but in-range* offset
> (e.g. counted over the raw FASTA including newlines, or relative to a locus
> start instead of the submitted slice) returns a confident `200` for the wrong
> window. Always assert on `meta.task_specific_counts.scored_window` (and
> `.tss_index`) in the response. Note also that `data.input.sequence_length` is
> the **scored** length (always 9,198); the length you submitted is
> `data.input.submitted_sequence_length` / `meta.sequence_length`.
>
> Both `tss_index` failures - "required unless exactly 9,198 bp" and the range
> check - come from a whole-model validator, so they report at `loc: ["body"]`,
> **never** `body.tss_index`. Match on `error.code == "validation_failed"`; never
> branch on `loc`.

**Splice: submit gene-sense.** Strand-specific, and the wrong strand fails
silently. Submit transcript orientation, reverse-complementing minus-strand
genes. A reverse-complemented sequence does *not* return zeros or an empty
result: it returns plausible sites at different positions, often still at high
confidence, and the site count can hold or collapse depending on the locus.
**Neither the score nor the count tells you the orientation was wrong**, so
there is no post-hoc check - get the orientation right on input. A gene-symbol
fetch follows the gene's own strand; a coordinate fetch does not, so a
minus-strand gene pulled by coordinates arrives antisense unless you
reverse-complement it yourself. `expression` never reverse-complements either;
`annotation` is strand-insensitive.

**A splice coordinate is a token span, not a junction.** Each site's
`start`/`end` bounds one variable-width tokenizer token - 4-10 bp across the
sequences measured so far - reported with a `token_index`. The exon/intron
junction sits somewhere inside that span, so do not reduce the pair to a single
base position, and do not intersect it against reference annotation as though it
marked a boundary.

**Omit `model` and the API uses the task's default** - that is the recommended
call. Default model IDs are intentionally **not** documented here: defaults change
and retired IDs fail hard, so never hardcode one. To pin a model, or to pick a
non-human one (Drosophila, yeast, and Arabidopsis models exist for several
tasks - match the species), discover IDs at call time with
`GET /v1/tasks/{task}/models` (REST) or `list_models` (MCP). **Never invent a
model ID.**

## How to Execute (REST)

Called synchronously - no `Prefer` header - a prediction is one request:

```python
import os, requests

BASE = os.environ.get("GI_BASE_URL", "https://api.genomicintelligence.ai")
HEADERS = {"Authorization": f"Bearer {os.environ['GI_API_KEY']}"}

def gi_predict(task, sequence, sequence_name, model=None, options=None, tss_index=None):
    body = {"sequence": sequence, "sequence_name": sequence_name}
    if model:   body["model"] = model
    if options: body["options"] = options
    if tss_index is not None: body["tss_index"] = tss_index   # expression only
    r = requests.post(f"{BASE}/v1/tasks/{task}/predict", headers=HEADERS, json=body)
    # 422 validation_failed - under the task floor OR over 500,000 bp, bad
    #   tss_index, missing options.description, or ANY unknown body/options key
    # 401 no/bad key | 404 unknown task | 413 body over 16 MiB | 429 rate limit
    r.raise_for_status()
    return r.json()               # {"data": {...}, "meta": {...}}

# Promoter:
out = gi_predict("promoter", seq, "TP53_region")
print(out["data"]["summary"])

# Expression - a pre-cut 9,198 bp TSS-centred window (tss_index defaults to 4,599):
out = gi_predict("expression", tss_window_9198bp, "HBB",
                 options={"description": "K562 cells"})
print(out["data"]["prediction"]["expression_log_tpm"])

# Expression - a whole locus, server cuts the window around the TSS you name.
# tss_index is 0-based into the whitespace-stripped sequence.
out = gi_predict("expression", locus_seq, "HBB", options={"description": "K562 cells"},
                 tss_index=tss_offset_in_locus)
print(out["meta"]["task_specific_counts"]["scored_window"])   # verify the right window
```

`Prefer: respond-async` is a declared header on **all six** predict operations
and on the composite - a `202` carries the same `{data, meta}` envelope with
`data = {job_id, status, links}` (job id also in `Content-Location` / `X-Job-Id`).
Async is JSON-only and available on every task; `annotation` is the one that
usually needs it: send
`Prefer: respond-async`, get a `job_id`, then poll `GET /v1/tasks/jobs/{job_id}`
until it returns `200` (a `202` means still running):

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
feed it to GI. For `expression`, either build the **9,198 bp TSS-centred window**
from the gene's canonical transcript (`expand=1`): 4,599 bp upstream + 4,598 bp
downstream on the gene's strand - or fetch a wider locus and pass the TSS offset
as `tss_index` and let the server cut it. Default species is **human, GRCh38**; use the
Ensembl production name for others (`mus_musculus`, `drosophila_melanogaster`).
Fetch at least the task floor (promoter 300, splice 100, enhancer 50, chromatin
200, annotation 1,000 bp) - and ideally at least the model's `context_window_bp`,
or the score reflects padding rather than sequence.

## Hosted MCP (keyless, preferred on MCP hosts)

Acquire a **sequence handle** (`sequence_ref`), then predict against it, so large
sequences never enter the context:

```
load_demo_sequence(name="promoter_tp53")  # keyless smoke test -> handle; name REQUIRED
fetch_ensembl_sequence(gene="TP53")       # gene symbol or Ensembl ID -> handle
fetch_region(region="chr11:5,225,000-5,235,000")   # coordinates -> handle
fetch_gene_for_expression(gene="HBB")     # TSS-centred 9,198 bp handle
predict_promoter(sequence_ref=<ref>)      # + predict_splice/_enhancer/_chromatin
predict_expression(sequence_ref=<ref>, description="K562 cells")
find_genes(sequence_ref=<ref>)                                   # annotation task
find_genes_and_predict_expression(sequence_ref=<ref>, description=...)  # composite
```

Note the hosted server exposes 15 tools and has **no** `predict_annotation`: the
annotation task is `find_genes`, which takes a handle rather than a region and
runs async internally (`wait=True` by default returns the result; `wait=False`
returns a `job_id` to poll with `get_job`). There is no `load_local_fasta` on the
hosted server either; use `store_inline_sequence`.
Reference context lives in the `gi://models`, `gi://docs/tasks`, and
`gi://account` MCP resources.

## Key Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/tasks/<task>/predict` | Six literal paths, one per task (add `Prefer: respond-async` for annotation). An unrecognised task is `404 not_found`, not a 422 |
| POST | `/v1/workflows/find-genes-and-predict-expression` | Composite (see below) |
| GET | `/v1/tasks/jobs` · `/v1/tasks/jobs/{job_id}` | List / poll async jobs (202 running -> 200 terminal) |
| GET | `/v1/tasks/{task}/models` | Model IDs + `bio_spec` for a task. Needs a key, and returns a **flat** `{task, default_model, models}` - not the `{data, meta}` envelope |

`bio_spec` carries `request_max_bp` (the enforced cap, 500,000 everywhere),
`context_window_bp` (the sliding window; null for annotation/expression) and
`trained_window_bp` (9,198 for the expression model). The legacy
`max_seq_length_bp` has been withdrawn and no longer appears in `bio_spec`;
`request_max_bp` is the cap. There is no `strand_sensitive` flag.

## Notes

- Errors: `422 validation_failed` is the catch-all - sequence under the task
  floor **or over 500,000 bp**, expression below 9,198 bp, missing/out-of-range
  `tss_index`, missing `options.description`, or any unknown body/`options` key.
  `401`/`403` missing/invalid key (REST). `404 not_found` unknown task or job.
  `413` means only `payload_too_large` (the 16 MiB raw-body cap) or
  `sync_too_large` (the composite above 50,000 bp synchronous - retry async),
  never an over-long sequence. `415 unsupported_format` for a bad `format` query
  value - there is no silent fallback to JSON. `429` rate cap (honour
  `Retry-After`; ask GI to raise the tier). `5xx` retry.
- `error.code` is a closed 21-value enum; treat an unlisted value as a generic
  failure, not a parse error. Branch on `code`, never on `details` or `loc`:
  `details` matches the declared schema - a validation failure carries
  `{errors: [{loc, msg, type}, ...]}` - so read it defensively all the same.
  `error.request_id` mirrors the `X-Request-Id` header and both are always
  populated; success envelopes carry `meta.request_id`. Every response carries
  `RateLimit-*` headers.
- The API serves the six literal predict operations, typed `options`, per-task
  floors, the published composite, the `Prefer` parameter, the `code` enum and
  the `bio_spec` fields described here. The served schema at
  https://api.genomicintelligence.ai/v1/openapi.json is the authority; check it
  if a detail here does not match.
- GI is a hosted service; nothing here ships weights or runs local inference.

## Follow-up Suggestions

- For "what genes are here and how are they expressed?", use the composite:
  `POST /v1/workflows/find-genes-and-predict-expression` (REST) or
  `find_genes_and_predict_expression` (MCP). `sequence` 1,000-500,000 bp and
  `options` are required, and `options.description` (cell type / assay) is
  required too - a missing or empty value is a `422`. It cuts a TSS-centred
  9,198 bp window per discovered gene (padding with `N` at region edges rather
  than dropping a gene) and returns a prediction each;
  `meta.task_specific_counts` = `{genes_found, genes_predicted, genes_skipped}`,
  per-gene causes in `data.expression_predictions[].skip_reason`. Above
  **50,000 bp** a synchronous call is `413 sync_too_large` - retry the same body
  with `Prefer: respond-async`.
- To explore available models per task, call `list_models` / `GET .../models`
  before predicting.
