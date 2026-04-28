---
name: energy-dashboard
description: Use when designing energy-domain dashboards — chart selection, unit conventions, real-time data visualization patterns, Sankey for energy flows, gauges for power, time-series for load/solar. Trigger on "design an energy dashboard", "visualize the grid data", "make a chart for the inverter".
---

# Energy Dashboard Patterns

## Chart selection by data type

| Data | Best chart | Library |
|------|-----------|---------|
| Power vs time (single device) | Line chart with area fill | Recharts `<AreaChart>` |
| Multi-device load comparison | Stacked area | Recharts `<AreaChart>` with stacked series |
| Energy flow (solar→battery→load) | Sankey diagram | Plotly `Sankey` |
| Grid topology + line loading | Network graph with edge color | D3-force or Cytoscape |
| Solar irradiance forecast | Line + confidence band | Recharts `<ComposedChart>` (line + area) |
| Battery SoC | Radial gauge | Custom SVG or `react-gauge-chart` |
| Appliance breakdown (NILM) | Stacked bar by hour | Recharts `<BarChart stackId>` |
| Tariff brackets | Histogram with bracket markers | Recharts `<BarChart>` + `<ReferenceLine>` |
| Battery cycle aging | Scatter + regression line | Recharts `<ScatterChart>` |
| Geographic asset map | Choropleth or markers | MapLibre GL or Leaflet |
| Market order book | Vertical bar pair | Recharts `<BarChart layout="vertical">` |
| Agent reasoning tree | DAG / tree | React Flow |
| Phase diagram (V vs I, polarization curve) | Scatter + line overlay | Recharts |
| Sensor heatmap (e.g., temp across pack) | Heatmap | Plotly `Heatmap` |

## Unit conventions (always show units)

| Quantity | Unit | Format |
|----------|------|--------|
| Power | W or kW | `1234.5 W` (W if < 10kW), `12.3 kW` (else) |
| Energy | Wh or kWh or MWh | scale to nearest 1000 |
| Current | A or mA | `1.234 A` |
| Voltage | V | `3.72 V` (2 dp for batteries) |
| Temperature | °C | `45.2 °C` |
| Cost | TND | `1.234 TND` (3 dp for millimes) |
| Tariff | millimes/kWh | `162 millimes/kWh` |
| Efficiency | % | `87.5 %` |
| Frequency | Hz | `50.02 Hz` |
| Solar irradiance | W/m² | `820 W/m²` |
| CO₂ | kg or t | scale appropriately |

## Color semantics (project-wide)

```css
--color-renewable: #16a34a;     /* green-600 */
--color-grid:       #2563eb;     /* blue-600 */
--color-battery:    #9333ea;     /* purple-600 */
--color-warning:    #f59e0b;     /* amber-500 */
--color-fault:      #dc2626;     /* red-600 */
--color-savings:    #0ea5e9;     /* sky-500 */
--color-agent:      #c026d3;     /* fuchsia-600 */
```

Use only these for energy semantics. Other UI elements (chrome, text) use neutral grays.

## Real-time update strategy

- **Sub-second sensor data:** WebSocket push, throttled to 5Hz on the client (no human can perceive faster).
- **1-5s smoothed data:** Polling every 5s with TanStack Query.
- **Hourly aggregates:** Polling every 60s.
- **Daily summaries:** Server Component with `revalidate: 3600`.

## Hero KPI strip pattern

Always pin 3-5 key numbers across the top:

```tsx
<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
  <KpiCard label="Current Power" value={1234.5} unit="W" trend="+12%" color="renewable" />
  <KpiCard label="Today's Energy" value={45.2} unit="kWh" trend="-3%" />
  <KpiCard label="Cost Today" value={7.32} unit="TND" />
  <KpiCard label="Efficiency" value={87} unit="%" status="good" />
  <KpiCard label="Active Alerts" value={2} status="warning" />
</div>
```

## Empty-state patterns

When data hasn't arrived:
- Skeleton with the chart's axes drawn (not a blank box).
- Show "Waiting for first reading from <deviceId>..." with a spinner.
- After 30s of no data, show "Device appears offline" with troubleshooting link.

## Pitch-day mode

Add a `?demo=1` URL param that:
- Increases all font sizes by 25%.
- Hides debug elements.
- Forces dark mode.
- Auto-replays a pre-recorded "best run" if real data isn't available.

## Localization

Numbers in French use `,` for decimal: `1 234,56 kWh`. Use `Intl.NumberFormat('fr-TN', ...)`.

```tsx
const fmt = new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
fmt.format(1234.5)  // "1 234,50"
```

For Arabic, use `Intl.NumberFormat('ar-TN', ...)` and check RTL layout.

## Things NOT to do

- Don't show "100" without a unit. Unitless numbers in an energy dashboard fail judging.
- Don't use rainbow gradients. Use the semantic palette.
- Don't animate updates with bouncy easing — energy people want trustworthy = stable.
- Don't show 6 decimal places. 2 is plenty.

## Hackathon checklist

- [ ] One hero KPI strip
- [ ] One time-series chart with units
- [ ] One semantic alert/event panel
- [ ] One "what is the AI doing right now" trace panel
- [ ] One CO₂ or TND impact counter
- [ ] Dark mode toggle (or just dark-only)
- [ ] FR/EN/AR language switcher (even if 1 of 3 is incomplete)
- [ ] Demo mode flag
