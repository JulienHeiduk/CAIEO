# NexusGraph AI — Cycle 3 Code Review

**Reviewer:** Senior Software Engineer  
**Date:** 2026-03-24  
**Scope:** Full codebase audit after Cycle 3 (commits `404f2d4` → `790b809`)

---

## 1. Implementation Quality

### 1.1 What's Actually Implemented (and Working)

| Module | Status | Verdict |
|--------|--------|---------|
| Project scaffold (`pyproject.toml`, `__init__.py` files, `.env.example`) | ✅ Complete | Solid |
| Catalog ingestion (`loader.py`, `models.py`) | ✅ Code complete | Good quality, untested |
| Embedding pipeline (`embedder.py`, `cache.py`) | ✅ Code complete | Clean design |
| Graph schema (`schema.py`) | ✅ Code complete | Well-typed |
| Neo4j writer (`writer.py`) | ✅ Code complete | Robust |
| Read-side queries (`queries.py`) | ✅ Code complete | Usable |
| LLM client factory (`llm.py`) | ✅ Code complete | Minimal but correct |
| CLI (`cli.py`) | ✅ Code complete | Only `ingest` subcommand |
| Docker / Compose / CI | ✅ Scaffolded | Functional |

> **Bottom line:** Significantly more code exists than the `TASKS.md` status suggests. Tasks 1–4 (bootstrap, ingestion, embedding, graph writer) are implemented — they just haven't been validated through tests or formal review.

---

### 1.2 Bugs & Issues Found

#### 🐛 BUG — `find_related` direction logic produces invalid Cypher (`queries.py:234-239`)

```python
if direction == "outgoing":
    arrow_left, arrow_right = "-[r]->", ""
elif direction == "incoming":
    arrow_left, arrow_right = "<-[r]-", ""
else:
    arrow_left, arrow_right = "-[r]-", ""
```

After closer inspection: `arrow_right` is always `""` and the pattern is assembled as `(a){arrow_left}(b){arrow_right}`. This works syntactically because the full arrow is in `arrow_left`. The variable naming is misleading, but it's not a runtime bug.

**Severity:** Cosmetic / maintainability concern only.

---

#### 🐛 BUG — `count_nodes()` silently returns wrong type (`writer.py:500-527`)

`count_nodes()` returns `dict[str, int]`, but the CLI at line 119 passes it directly to a log format expecting an `int`:

```python
n_nodes = writer.count_nodes()          # ← dict, not int
n_rels = writer.count_relationships()   # ← dict, not int
logger.info("... %d node(s) and %d relationship(s).", n_nodes, n_rels)
```

This raises `TypeError: %d format: a number is required, not dict` at runtime.

**Severity: HIGH** — the CLI `ingest` command crashes after a successful write.

---

#### 🐛 BUG — APOC dependency in `count_nodes()` (`writer.py:509-516`)

The primary query uses `apoc.cypher.run` for dynamic label counting. APOC is installed in docker-compose, but:

- The fallback only covers `Product` and `Category` labels — other labels added later will have incomplete counts.
- Running outside Docker (dev machine) hits the fallback silently.

**Severity: LOW** — the fallback exists and works for the current schema.

---

#### ⚠️ ISSUE — `ProductNode` docstring ghost field (`schema.py:157-159`)

The docstring documents an `embedding` field that does not exist on the dataclass:

```
embedding:
    Optional dense vector representation (not stored in Neo4j by default;
    used by the inference layer).
```

No `embedding` attribute is declared.

**Severity: MEDIUM** — misleading for developers; `TASKS.md` Task 1 correctly identifies this as needing a fix.

---

#### ⚠️ ISSUE — `save_cache` is not truly atomic (`cache.py:154-162`)

The docstring claims *"Both files are written atomically"* but the implementation writes `ids.json` and then `embeddings.npy` sequentially with no temporary files or rename. A crash between the two writes leaves the cache in an inconsistent state.

**Severity: LOW** for a development tool, but the docstring is misleading.

---

#### ⚠️ ISSUE — `_load_csv` reads entire file as `dtype=str` (`loader.py:185-190`)

All columns are read as strings via `dtype=str`. This is intentional (let Pydantic validators handle type coercion), but `keep_default_na=False` and the explicit `na_values` list partially conflict. This actually works correctly because pandas applies `na_values` regardless of `keep_default_na`, but it's confusing to read.

**Severity:** Cosmetic.

---

#### ⚠️ ISSUE — `get_settings()` uses `lru_cache` which prevents reloading (`config.py:66-69`)

The `@lru_cache(maxsize=1)` makes the settings singleton immutable for the process lifetime. Fine in production, but makes testing harder — tests cannot override settings without monkeypatching the cache. Consider adding a `get_settings.cache_clear()` call in test fixtures.

**Severity: LOW** — standard pattern, but worth noting for test infrastructure.

---

### 1.3 Security Concerns

- `neo4j_password` default is `"changeme"` (`config.py:33`) — acceptable for dev, but `docker-compose.yml` exposes port `7687` with the same default. Add a comment/warning that this **MUST** be changed in production.
- No input sanitisation in `queries.py` — the `direction` parameter in `find_related` is interpolated into the Cypher string, but it's validated via the `if/elif/else` chain (lines 234-239) so only three known patterns are possible. Safe, but only because the current code path is simple.
- `count_nodes()` constructs Cypher via string concatenation with label names (`writer.py:510-514`) — `MATCH (n:' + label + ')` — but `label` comes from `db.labels()`, which is server-controlled. No injection risk in practice.

---

## 2. Feature Completeness

### Spec vs. Reality Matrix

| README Feature | Implemented | Notes |
|---|---|---|
| CSV/JSON ingestion | ✅ | Fully implemented with alias normalisation |
| Semantic embeddings (sentence-transformers) | ✅ | `all-MiniLM-L6-v2`, disk caching |
| LLM-based relationship classification | ❌ Missing | `llm.py` provides client factory, but no `classifier.py` |
| 7 typed relationship types | ✅ Schema only | `RelType` enum defined, no inference to populate them |
| Neo4j persistence | ✅ | Writer, constraints, batched MERGE |
| Query layer | ✅ | `queries.py` covers products, relationships, paths, summary |
| FastAPI REST endpoints | ❌ Empty stub | `api/__init__.py` has `__all__ = []` |
| JSON-LD export | ❌ Missing | Core deliverable, not started |
| RDF export | ❌ Missing | `rdflib` in deps but unused |
| GraphML export | ❌ Missing | `networkx` in deps but unused |
| Cypher dump export | ❌ Missing | No export module exists |
| In-memory NetworkX graph | ❌ Missing | No `nx_graph.py` |
| Interactive visualisation | ❌ Missing | No Pyvis/D3 integration |
| Pipeline orchestrator | ❌ Missing | No `pipeline.py` |
| Docker / Compose | ✅ | Neo4j + app service, CI workflow |
| CLI | ⚠️ Partial | Only `ingest` subcommand (no `embed`, `classify`, `export`, `serve`) |

**Completion estimate: ~40% of the spec is implemented.** The "data in" path (ingest → embed → write nodes) exists but the "intelligence" path (classify relationships) and "data out" path (export, API, visualisation) are entirely missing.

---

## 3. Code Quality

### 3.1 Architecture — Strengths

- Clean layered separation: `ingestion → inference → graph → api → utils`
- Lazy imports for heavy dependencies (`neo4j`, `sentence_transformers`) — fast cold starts
- Pydantic v2 validators in `models.py` are thorough — currency stripping, NaN handling, JSON string coercion
- Docstrings are excellent throughout — numpydoc-style with examples
- Type annotations are consistently applied, including `TYPE_CHECKING` guards
- Context manager pattern on `Neo4jWriter` prevents resource leaks
- Idempotent writes via `MERGE` — safe to re-run

### 3.2 Architecture — Weaknesses

- **No abstraction between `Embedder` and `Neo4jWriter`:** The CLI jumps directly from `load_catalog()` to `writer.write_products()`, skipping the embedding step entirely. There's no pipeline orchestrator to tie the stages together.
- **`graph/__init__.py` exports `queries` in `__all__` but doesn't import the module** — `from nexusgraph.graph import queries` works, but `queries` doesn't appear as an attribute of the package after `import nexusgraph.graph` unless accessed explicitly. Minor, but inconsistent with the `__all__` declaration.
- **`_ALIAS_TO_CANONICAL` collisions for `"type"` and `"details"`** — if a catalog has a `type` column meaning product type (rather than category), it's silently remapped. Documented, but could surprise users.

### 3.3 Naming & Style

Generally excellent. Two callouts:

- `arrow_left`/`arrow_right` in `queries.py` — `arrow_right` is always `""`. Rename to `relationship_pattern` or use a single variable.
- `_build_openai_client(settings)` and `_build_mistral_client(settings)` — `settings` param has no type annotation (lines 99 and 121 of `llm.py`).

### 3.4 Duplication

Minimal. The Cypher query templates in `queries.py` (lines 73-82, 116-128, 163-182) repeat the same `RETURN p.id AS id, p.name AS name, ...` projection. A helper like `_PRODUCT_RETURN_CLAUSE` would reduce this.

---

## 4. Test Coverage

### Current State: Critical Gap

| Test file | Tests | What's covered |
|---|---|---|
| `test_package.py` | 4 | Import smoke tests + settings defaults |
| `test_ingestion.py` | 0 | Does not exist |
| `test_embedder.py` | 0 | Does not exist |
| `test_writer.py` | 0 | Does not exist |
| `test_queries.py` | 0 | Does not exist |
| `test_cli.py` | 0 | Does not exist |

### Critical Untested Paths

- **`load_catalog()` end-to-end** — CSV parsing, JSON envelope detection, column aliasing, Pydantic validation, bad-row skipping. All untested despite 35-row fixtures being ready.
- **`Embedder.embed_products()`** — Cache hit/miss logic, merge logic, empty-list edge case. Needs mocked `SentenceTransformer`.
- **`Neo4jWriter.write_products()`** — Batching, auto-category creation, idempotent MERGE. Needs mocked Neo4j driver.
- **CLI `cmd_ingest`** — The `%d` format bug (§1.2) would be caught by even a basic integration test.
- **`RelationshipEdge.__post_init__`** — Confidence validation, `rel_type` coercion, `target_label` auto-resolution. Easy to unit test.

### Recommendation

The minimum viable test suite before next cycle should cover:

- `test_ingestion.py` — 6-8 tests against the CSV/JSON fixtures
- `test_schema.py` — `ProductNode.from_product()`, `RelationshipEdge` validation, `RelType` coercion
- `test_cli.py` — at least `--dry-run` mode (no Neo4j needed)

---

## 5. Next Cycle Readiness & Prioritised Recommendations

### P0 — Fix Before Next Cycle (Blockers)

| # | Issue | File | Fix |
|---|---|---|---|
| 1 | CLI crash: `count_nodes()` returns `dict` but `%d` format expects `int` | `cli.py:119-121` | Change to `sum(n_nodes.values())` and `sum(n_rels.values())` |
| 2 | Zero test coverage on implemented features | `tests/` | Write `test_ingestion.py` + `test_schema.py` minimum |
| 3 | Ghost `embedding` field in `ProductNode` docstring | `schema.py:157-159` | Either add the field or remove the docstring reference |

### P1 — Next Cycle Tasks (Highest-Value Work)

| Priority | Task | Rationale |
|---|---|---|
| 🔴 1 | Relationship classifier (`inference/classifier.py`) | Core differentiator — without it, the "knowledge graph" has only taxonomic edges, not inferred semantic ones. `TASKS.md` Task 2 spec is well-defined. |
| 🔴 2 | Pipeline orchestrator (`pipeline.py`) | Connects all stages into a single `run_pipeline()` call. Currently the CLI only writes nodes — embeddings are computed but not used, and relationships are never inferred. |
| 🟡 3 | In-memory NetworkX graph (`graph/nx_graph.py`) | Required by all four export formats (JSON-LD, RDF, GraphML, Cypher dump). Build this before exporters. |
| 🟡 4 | Export module (`graph/exporters.py`) | Core spec deliverable. Depends on NetworkX graph. |
| 🟠 5 | FastAPI layer (`api/`) | Can be deferred one more cycle if pipeline + exports land first. |

### P2 — Technical Debt to Address

| Item | Details |
|---|---|
| `count_nodes()` APOC dependency | Replace with `CALL db.labels()` + `count{(n) WHERE $label IN labels(n)}` (Neo4j 5 native) |
| `save_cache` atomicity claim | Either implement write-to-temp + rename, or fix the docstring |
| Settings testability | Add `get_settings.cache_clear()` in a pytest fixture |
| `docker-compose.yml` version key | Deprecated in Compose V2 — remove `version: "3.9"` line |
| `spacy` in `pyproject.toml` deps | Listed but never imported anywhere — remove or defer until needed |
| `queries.py` return clause duplication | Extract shared `_PRODUCT_RETURN_CLAUSE` constant |
| Variable naming in `find_related` | Rename `arrow_left`/`arrow_right` to `rel_pattern` (single variable) |

---

## Summary Scorecard

| Dimension | Score | Comment |
|---|---|---|
| Implementation quality | 7/10 | Code is well-written but the CLI has a runtime crash, and the `ProductNode` docstring is misleading |
| Feature completeness | 4/10 | ~40% of the spec. The hard part (inference + export + API) is entirely missing |
| Code quality | 8/10 | Excellent structure, typing, docstrings, lazy imports. Minor issues only |
| Test coverage | 2/10 | 4 smoke tests for a 1200+ LOC codebase. No functional tests exist |
| Next cycle readiness | 7/10 | Foundations are solid. Task specs are clear. The P0 fixes are <30 min of work |

---

> **Overall:** The foundational layers are well-engineered. The team should resist adding more features and instead (1) fix the CLI crash, (2) write tests for what exists, then (3) build the relationship classifier which unlocks the project's core value proposition.

---

## Actions Taken

### P0 Fixes (3 bugs resolved)

| # | Fix | File | Detail |
|---|---|---|---|
| 1 | CLI crash | `cli.py:115-121` | `count_nodes()` and `count_relationships()` return `dict[str, int]`, but were passed to `%d` format strings. Fixed by summing the dict values with `sum(n_nodes.values())` / `sum(n_rels.values())`. |
| 2 | Ghost embedding field | `schema.py:173` | Added `embedding: Optional[list[float]] = field(default=None, repr=False)` to `ProductNode` — matches the docstring contract. The field is excluded from `to_neo4j_props()` (verified by test). |
| 3 | Zero test coverage | `tests/` | Created 3 new test files (see below). |

### Tests Written (58 new tests → 62 total)

| File | Tests | Coverage |
|---|---|---|
| `tests/test_ingestion.py` | 23 | `load_catalog()` CSV & JSON, column aliasing, `Product` validators (price, attributes, name), error paths (missing file, bad format, missing columns, malformed JSON, bad rows) |
| `tests/test_schema.py` | 20 | `RelType` enum (7 types, case-insensitive, `cypher_type`), `ProductNode` (`from_product`, embedding field, `to_neo4j_props`), `CategoryNode`, `RelationshipEdge` (coercion, confidence bounds, `target_label` auto-resolution) |
| `tests/test_cli.py` | 9 | Argument parser, `ingest` subcommand, `--dry-run`, `--log-level`, error exit codes |

**Result: 62/62 tests passing in 1.84s** — no Neo4j or model downloads required.
