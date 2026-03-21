# Cell Annotation Technical Reference

## Strategy Selection

### Use broad labels when

- the atlas is from a different tissue or disease context
- cluster markers support lineage identity but not subtype identity
- confidence scores are modest and fine categories disagree across methods

### Use fine labels when

- cluster markers support the proposed subtype
- the reference atlas is closely matched
- the confidence pattern is stable across neighboring cells

## Confidence Interpretation

For `celltypist`:

| Confidence | Suggested action |
|---|---|
| `> 0.5` | keep as provisional label |
| `0.2-0.5` | review with markers and cluster context |
| `< 0.2` | usually mark `Unknown` or `Uncertain` |

These are heuristics, not universal rules.

## Minimum Marker Review

For every major cluster, verify at least one positive marker and one exclusion marker when possible.

Examples:

- T cell: `CD3D`, `IL7R`
- B cell: `MS4A1`, `CD79A`
- Monocyte: `LYZ`, `S100A8`, `FCGR3A`

## Recommended Output Columns

- `cell_type_raw`
- `cell_type_confidence`
- `cell_type_final`
- `annotation_notes`
- `annotation_model`

## Failure Modes

- label confidence is high but markers disagree
  - likely atlas mismatch or cluster artifact
- every cluster gets a different fine immune subtype
  - clustering may be too fine
- one cluster maps to multiple unrelated labels
  - keep the cluster uncertain and revisit preprocessing
