import { MapPin } from 'lucide-react'

// Static placeholder for now — hardcoded hotspot positions/intensity and stats. Once wired to
// real data this becomes an interactive map (per-sector detection counts, same idea as the
// DroneSeva sector overlay), and the stats panel gets swapped for the real design.
const HOTSPOTS = [
  { cx: 28, cy: 32, r: 15, intensity: 0.65 },
  { cx: 58, cy: 48, r: 22, intensity: 1 },
  { cx: 78, cy: 22, r: 12, intensity: 0.4 },
  { cx: 18, cy: 68, r: 11, intensity: 0.35 },
  { cx: 47, cy: 18, r: 9, intensity: 0.3 },
  { cx: 70, cy: 72, r: 14, intensity: 0.55 },
  { cx: 40, cy: 62, r: 10, intensity: 0.4 },
]

const STATS = [
  { label: 'Busiest sector', value: 'District Golf', detail: '22 objects flagged' },
  { label: 'Most common waste', value: 'Scrap', detail: '31% of all detections' },
  { label: 'Total flagged locations', value: '185', detail: 'across 12 sectors' },
  { label: 'Highest-severity zone', value: 'District Hotel', detail: '31 objects · Tyres' },
]

function heatColor(intensity: number) {
  // Warm scale: dim red (low) -> hot orange/yellow (high) — conventional heatmap language.
  if (intensity >= 0.8) return '#fbbf24'
  if (intensity >= 0.5) return '#fb923c'
  return '#f87171'
}

export function GarbageHeatmap() {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-b-2xl lg:grid-cols-[1fr_280px]">
      <div className="relative aspect-[16/9] border-b border-border bg-[#0a0d12] lg:aspect-auto lg:min-h-[280px] lg:border-b-0 lg:border-r">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <pattern id="heatmap-grid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path
                d="M 8 0 L 0 0 0 8"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="0.4"
              />
            </pattern>
            {HOTSPOTS.map((h, i) => (
              <radialGradient key={i} id={`heat-${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={heatColor(h.intensity)} stopOpacity={h.intensity} />
                <stop offset="100%" stopColor={heatColor(h.intensity)} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          <rect width="100" height="100" fill="url(#heatmap-grid)" />

          {HOTSPOTS.map((h, i) => (
            <circle key={i} cx={h.cx} cy={h.cy} r={h.r} fill={`url(#heat-${i})`} />
          ))}

          {HOTSPOTS.map((h, i) => (
            <circle
              key={`dot-${i}`}
              cx={h.cx}
              cy={h.cy}
              r="0.9"
              fill={heatColor(h.intensity)}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="0.3"
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 backdrop-blur-sm">
          <MapPin className="h-3 w-3 text-muted" />
          <span className="text-[11px] font-medium text-muted-strong">Preview — static data</span>
        </div>

        <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 backdrop-blur-sm">
          <span className="text-[10px] text-muted">Low</span>
          <span className="h-1.5 w-16 rounded-full bg-gradient-to-r from-[#f87171]/50 via-[#fb923c] to-[#fbbf24]" />
          <span className="text-[10px] text-muted">High</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {STATS.map((stat) => (
          <div key={stat.label} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted/70">
              {stat.label}
            </p>
            <p className="mt-1 text-base font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted">{stat.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
