---
name: web-search
description: Search the general web for current information using the You.com MCP search endpoint. Use when the user asks to search the web, look something up online, find recent news, preprints, method docs, tool documentation, or non-biomedical sources not covered by PubMed. Triggers on "web search", "search online", "search the web", "look up online", "google", "find recent news", "latest version", "current documentation".
---

# Web Search (You.com MCP)

Search the general web via the You.com MCP endpoint, called directly with `curl` (no API key needed).

Use this when a question needs current or non-PubMed sources: preprints, method documentation, tool changelogs, news, product pages, or background facts. For biomedical literature specifically, prefer the `pubmed-search` skill first.

## When to Use

- User asks to search the web or look something up online
- User wants recent news, announcements, or release info
- User needs current documentation or tutorials for a tool/library
- A question is outside PubMed's scope (protocols, software, chemistry, general science news)
- PubMed results are thin and broader web coverage would help

## How to Execute

### 1. Run the search

The keyless endpoint works over plain HTTP JSON-RPC. One stateless POST per call:

```bash
curl -s -m 60 -X POST "https://api.you.com/mcp?profile=free" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "you-search",
      "arguments": { "query": "Oxford Nanopore Q20+ chemistry accuracy", "count": 10 }
    }
  }'
```

The response is an SSE stream; the JSON payload is on the `data:` line. Extract it with `grep`/`sed` or pipe through `python3 -c` to parse JSON, then pull out `results.web[]` fields: `url`, `title`, `description`, `page_age`.

Tips:

- Phrase the query as one natural intent ("crispr delivery review 2026"), not a question or a pile of synonyms.
- Inline filters are supported: `site:biorxiv.org`, `lang:de`, `loc:CN`.
- Add `"freshness": "month"` (or `week`/`year`) when recency matters; omit it for evergreen facts.

### 2. Read a promising page

For any result worth citing in detail, use the built-in `WebFetch` tool on the URL to read the full page.

### 3. Output format for chat

```
*Web Search: "Oxford Nanopore Q20+ chemistry accuracy"*

*1.* Q20 chemistry delivers improved raw read accuracy...
   _nanoporetech.com — 2026_
   https://...

*2.* Benchmarking Q20 vs R10.4 flow cells
   _biorxiv.org — preprint_
   https://...

_Top hits summarized. Want me to open and summarize any of these?*
```

### 4. Fallbacks

- If the endpoint is unreachable or returns an error, tell the user and fall back to the built-in `WebSearch` tool.
- If results are empty, widen the query (drop filters, fewer terms) rather than repeating it.

## Optional: authenticated endpoint

The keyless profile above is rate-limited. For heavier use, You.com offers an authenticated endpoint with the same tool interface — get a key at [you.com/platform/api-keys](https://you.com/platform/api-keys) and send it as a bearer token (the key is only needed for this variant; the free profile above needs none):

```bash
curl -s -m 60 -X POST "https://api.you.com/mcp" \
  -H "Authorization: Bearer YOUR_YDC_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{ ...same body... }'
```

If no key is configured, always use the keyless `profile=free` URL.
