# Questions & Limitations Ledger

Agents automatically record discovered gaps, issues/limitations, and open questions per wave in `docs/questions-and-limitations/<wNN>-gaps.md` during wave execution and validation (`wave-validate`).
When each wave lands on `main` (`wave-land`), all per-wave files are compiled into [GAPS_AND_QUESTIONS.md](./GAPS_AND_QUESTIONS.md) for owner review and remediation.

## Per-Wave File Format (`<wNN>-gaps.md`)

```markdown
# wNN — Gaps, Issues & Open Questions

| ID | Type | Spec / Area | Description | Proposed resolution | Status |
|---|---|---|---|---|---|
| wNN-G01 | Gap \| Issue \| Question | docs/specs/... | ... | ... | Open \| Resolved |
```

Step 1 (spec authoring) items are recorded directly in [GAPS_AND_QUESTIONS.md](./GAPS_AND_QUESTIONS.md) with IDs `Q-NN`.
