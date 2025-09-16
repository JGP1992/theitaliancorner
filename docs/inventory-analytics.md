# Inventory Analytics & Baseline Modes

This document explains how the inventory dashboard derives current stock, how to adjust temporal analysis, and how to export detailed history.

## Core Concepts
- **Master Snapshot (Baseline)**: A stocktake flagged `isMaster=true` representing the authoritative baseline of inventory. Created automatically when needed (unless forcing `latest`).
- **Latest Snapshot**: The most recent (non-master) stocktake; can be used as an analytic baseline when exploring short-term changes ignoring the master snapshot.
- **Movements**: Aggregated changes after the baseline within a selected date range:
  - Incoming: Receipts / orders into factory.
  - Outgoing: Deliveries / dispatches leaving factory.
  - Production: Net production effect (positive when finished goods created; negative when ingredients consumed to make them if modeled separately).
- **Derived Current**: `baselineQuantity + (incoming - outgoing + production)`.

## Baseline Modes
Selector values:
- **Auto** (default): Use Master if present; create one if absent. Falls back to latest only if absolutely necessary.
- **Master**: Force use (and auto-create if missing) of the Master Snapshot.
- **Latest**: Ignore Master; use the most recent non-master stocktake as baseline. Auto-creation suppressed.

Returned API fields:
- `baselineMode`: Echo of applied mode.
- `partialWindow`: True if your chosen `from` date precedes the baseline (indicating incomplete early movement data).
- `dateRange`: `{ from, to }` normalized to ISO date boundaries.

## Date Range & Presets
You can set a custom From / To (inclusive dates). Preset shortcuts:
- Today
- Yesterday
- Last 7 Days
- Last 30 Days
- Month-to-Date (MTD)
- Previous Month

When the selected range spans multiple days, column headers change from e.g. `Incoming` to `Incoming (Range)` to emphasize aggregation.

## Pagination & Page Totals
Client-side pagination slices the result set to keep the table responsive:
- Controls: page (1-based) and pageSize selector.
- Does not refetch; purely client slicing of already-fetched items.
- Future enhancement: server pagination or virtualization if item counts become very large.

At the bottom of the inventory table, a Totals (page) row sums the currently visible page for:
- Current
- Incoming
- Outgoing
- Production

## Per-Item Derivation Tooltip
Hover each item's current quantity to reveal the detailed derivation:
```
Baseline: <qty>
+ Incoming: <qty>
- Outgoing: <qty>
+ Production: <qty>
= Current: <qty>
```
(Signs reflect net formula.)

## Movement Drawer (Aggregate)
A collapsible panel summarizes total Incoming, Outgoing, and Production since the baseline across the selected date window. Useful for auditing large directional shifts fast.

## Item History Modal
Click an item row (or designated action) to open a modal with a day-by-day ledger:
- Columns: Date, Incoming, Outgoing, Production, Net.
- Includes a Download CSV button producing per-day history for that single item respecting the active date range & baseline mode.

## CSV Export Options
Two pathways:
1. **Client CSV (All Items)**: Immediate browser-side generation, includes baseline, movements, and derived current for each item under current filters.
2. **Server CSV Endpoint**: `GET /api/inventory/export?from=YYYY-MM-DD&to=YYYY-MM-DD&baselineMode=...` streams a generated CSV (safer for large datasets).

Per-Item History CSV (from modal) lists per-day breakdown for that item only.

Parameter consistency:
- The Server CSV export link includes the selected `baselineMode` (when not `auto`), plus `from` and `to`.
- The per-item history request also includes `from`, `to`, and `baselineMode` to maintain consistency with the main view.

## Partial Window Warning
If `from` is earlier than the baseline date, a warning banner appears: early movement days before the baseline are not included (baseline already encapsulates them).

## Edge Cases & Notes
- If no Master exists and mode is Auto or Master, one is created automatically at current state before aggregating movements.
- For `latest` mode, absence of any stocktake triggers a fallback creation (and you may consider taking a manual master afterward for stability).
- Negative movement components: Outgoing subtracts from net; Production may be positive (finished goods) or represent dual entries if ingredients vs outputs are modeled distinctly.
- Timezones: Dates treated as local day boundaries (00:00–23:59 local). Ensure server and client share an agreed timezone strategy if doing cross-regional ops.

## Future Enhancements (Planned / Optional)
- Server-side pagination or streaming inventory dataset.
- Virtualized table rendering for extremely large inventories.
- Historical baseline selector (choose any prior snapshot as baseline anchor).
- True streaming (chunked) CSV for very large exports.

## Quick Reference Formula
```
current = baseline + incoming - outgoing + production
```

## Troubleshooting
| Symptom | Likely Cause | Resolution |
|---------|--------------|-----------|
| Partial window banner shows unexpectedly | From date earlier than baseline | Adjust From date or accept that earlier movements are baked into baseline |
| Zero movements but unexpected current | Baseline already includes previously assumed movements | Inspect baseline stocktake record detail |
| Large CSV download is slow | Client memory build for huge dataset | Use server export endpoint |
| Discrepancy between tooltip and table | Race condition from stale fetch | Refresh / ensure fetch params updated after changing filters |

---
For deeper auditing, consider enabling verbose movement logs or adding a movement ledger export endpoint.
