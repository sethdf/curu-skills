# DEPRECATED

**This skill has been superseded by the Intake System.**

## Migration Path

The new Intake System in `imladris/lib/intake/` provides:

| Old (UnifiedInbox) | New (Intake) |
|-------------------|--------------|
| `inbox sync` | `intake sync <source>` |
| `inbox query` | `intake query [options]` |
| `inbox stats` | `intake stats [zone]` |
| `inbox triage` | `intake triage [list|run]` |
| `inbox mark-read` | Not yet implemented |

## Key Improvements

1. **Zone Support**: Native work/home zone differentiation via `$ZONE` environment variable
2. **Thread-First Model**: Chat conversations are triaged as units, not individual messages
3. **Local Embeddings**: Transformers.js with all-MiniLM-L6-v2 for semantic similarity
4. **Multi-Layer Classification**:
   - Enrichment (chrono-node dates, compromise NLP)
   - Deterministic Rules (json-rules-engine)
   - Similarity Search (vector-based)
   - AI (only for ambiguous cases)
5. **Better Schema**: Dedicated messages table for conversation threads

## Database Locations

| Version | Path |
|---------|------|
| Old | `/data/.cache/unified-inbox/inbox.sqlite` |
| New | `/data/.cache/intake/intake.sqlite` |

## Migration Script

To migrate existing data (one-time):

```bash
# Export old items
sqlite3 /data/.cache/unified-inbox/inbox.sqlite ".dump items" > old-items.sql

# The new schema is different, so manual mapping is required
# Contact Seth for migration assistance
```

## Timeline

- **2026-01-26**: Intake System created
- **2026-02-01**: UnifiedInbox marked deprecated (this notice)
- **2026-03-01**: UnifiedInbox will be removed

## Questions?

The new system is in: `~/repos/github.com/sethdf/imladris/lib/intake/`

Run `intake help` for usage.
