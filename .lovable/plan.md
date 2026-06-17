## Chart improvements (Dashboard)

Focused polish for the two charts on the Dashboard, optimized for mobile (360px) where most issues show up.

### Cash flow chart (last 30 days)
- Switch from raw `Line` to a smooth **stacked area** with gradient fills (inflow green, outflow red) for a cleaner, more readable shape than the spiky lines.
- Fix duplicate axis labels (`2k, 2k, 1k, 1k…`) by formatting ticks consistently and de-duplicating: round to nearest 500 and use `allowDecimals={false}` + a stable `tickFormatter`.
- Reduce x-axis crowding: show only ~6 ticks (`interval="preserveStartEnd"` + computed interval), rotate slightly on mobile, and shorten format to `Jun 8` style.
- Add subtle horizontal-only gridlines (drop vertical), thinner border color.
- Add a compact **net line** overlay (inflow − outflow) toggleable via a small segmented control: All / In / Out / Net.
- Improve tooltip: bold date header, KES formatting already in place, add a "Net" row.
- Empty-state when all values are 0.

### Top spending categories (donut)
- Add **center label** showing total spend and "This period".
- Add **outer labels with leader lines** for top 3 slices (category + %); rest grouped into "Other".
- Move legend to a 2-column list **below** the donut on mobile with color dot + name + amount + % — currently the legend is cut/cramped.
- Slightly thicker ring, remove white stroke (uses card bg via `stroke="hsl(var(--card))"`) for cohesion with dark theme.
- Use a refined palette aligned with existing tokens (inflow/outflow/warning/primary + 2 accents) instead of the current bright mix.

### Shared
- Wrap both in consistent card headers with a small time-range hint ("Last 30 days" / "This month").
- Ensure responsive heights: 220px on mobile, 256px on md+.
- Keep all colors as `hsl(var(--…))` tokens; no hardcoded hex.

### Files to change
- `src/pages/Dashboard.tsx` — chart components, data shaping (add net series, totals, top-3 + other), legend/center label, axis formatters, segmented toggle.

### Out of scope
- Reports page charts (can follow up if you want the same treatment).
- New backend data or aggregations.
