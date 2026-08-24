'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Map as MLMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type FilterSpecification,
  type LngLat,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre v6 spins up an ES module Worker for vector-tile parsing, resolved
// via `new URL(..., import.meta.url)` against its own bundled chunk. Turbopack
// doesn't rewrite that reference correctly, so the worker 404s (Next serves
// its HTML error page instead of JS) and every vector tile silently fails to
// decode while the raster basemap keeps working fine since it needs no
// worker. Pointing at a statically-served copy in /public sidesteps bundler
// worker resolution entirely. Keep public/maplibre-gl-worker.mjs and
// public/maplibre-gl-shared.mjs in sync with the installed maplibre-gl
// version (they must stay in the same directory — the worker imports the
// shared module by relative path).
setWorkerUrl('/maplibre-gl-worker.mjs')
import { CLASS_GROUP_COLORS, ROAD_TYPE_COLORS } from '@/lib/classColors'
import StatsPanel from '@/components/map/StatsPanel'
import Panel from '@/components/map/Panel'
import { ChartBarIcon, CompassIcon, LayersIcon, SearchIcon, TagIcon } from '@/components/map/icons'

type Sector = {
  sector_no: number
  name: string
  area_hac: number
  lng: number
  lat: number
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

const CENTER: [number, number] = [78.0995, 29.9396]
const INITIAL_ZOOM = 10

function matchExpr(
  field: string,
  colors: Record<string, string>,
  fallback: string,
): ExpressionSpecification {
  const pairs = Object.entries(colors).flat()
  return ['match', ['get', field], ...pairs, fallback] as unknown as ExpressionSpecification
}

type InitialParcel = {
  sectorPlanId: number
  lng: number
  lat: number
  sectorNo: number | null
}

export default function MapView({
  initialParcel = null,
}: {
  /** Set when arriving from a ticket's "View on map" link — flies straight to that parcel
   *  instead of the default Haridwar-wide view, and pre-selects its sector. */
  initialParcel?: InitialParcel | null
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const hoveredSectorRef = useRef<number | null>(null)
  /** sectorPlanId of the parcel the currently-open popup belongs to — lets the async ticket
   *  lookup discard its result if the user has since clicked a different parcel (or closed it). */
  const popupParcelIdRef = useRef<number | null>(null)

  const [sectors, setSectors] = useState<Sector[]>([])
  const [selectedSector, setSelectedSector] = useState<number | 'all'>(
    initialParcel?.sectorNo ?? 'all',
  )
  const [visibility, setVisibility] = useState({
    sector_plan: true,
    road: true,
    sector_boundary: true,
  })
  const [opacity, setOpacity] = useState({ sector_plan: 0.75, road: 1, sector_boundary: 1 })
  const [classFilter, setClassFilter] = useState<string | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showStats, setShowStats] = useState(true)

  useEffect(() => {
    fetch('/api/sectors')
      .then((r) => r.json())
      .then(setSectors)
      .catch(() => {})
  }, [])

  function propertyRowsHtml(feature: MapGEOJSONFeatureCompat) {
    const p = feature.properties ?? {}
    const rows: [string, unknown][] =
      feature.layer.id === 'road-line'
        ? [
            ['Road name', p.road_name],
            ['Type', p.type],
            ['ROW width (m)', p.row_width_m],
            ['Sector', p.sector_no],
          ]
        : feature.layer.id === 'sector-boundary-line' || feature.layer.id === 'sector-hit-target'
          ? [
              ['Name', p.name],
              ['Sector no.', p.sector_no],
              ['Area (ha)', p.area_hac],
            ]
          : [
              ['Label', p.label],
              ['Class', p.class],
              ['Subclass', p.subclass],
              ['Plot No.', p.plot_no],
              ['Block', p.block],
              ['Sector', p.sector_no ?? 'Peripheral'],
              ['Area (ha)', typeof p.area === 'number' ? p.area.toFixed(3) : p.area],
            ]

    return rows
      .filter(([, v]) => v !== undefined)
      .map(
        ([k, v]) =>
          `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;color:#111827"><b>${k}</b><span>${
            v === null || v === '' ? '—' : v
          }</span></div>`,
      )
      .join('')
  }

  function ticketRowsHtml(ticket: {
    number: number
    subject: string
    status: { name: string; color: string } | null
    priority: { name: string; color: string } | null
  }) {
    return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        ${
          ticket.status
            ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:${ticket.status.color}"><span style="height:6px;width:6px;border-radius:999px;background:${ticket.status.color}"></span>${ticket.status.name}</span>`
            : ''
        }
        ${
          ticket.priority
            ? `<span style="font-size:11px;font-weight:600;color:${ticket.priority.color}">${ticket.priority.name}</span>`
            : ''
        }
      </div>
      <p style="margin:0 0 6px;font-size:12.5px;color:#374151">${ticket.subject}</p>
      <a href="/tickets/${ticket.number}" style="color:#2563eb;font-weight:600;text-decoration:none;font-size:12.5px">Show the Ticket →</a>
    </div>`
  }

  function showPopup(map: MLMap, feature: MapGEOJSONFeatureCompat, lngLat: LngLat) {
    popupRef.current?.remove()
    popupParcelIdRef.current = null

    const html = `<div style="font:13px system-ui;min-width:180px;color:#111827">${propertyRowsHtml(feature)}</div>`
    const popup = new Popup({ closeButton: true }).setLngLat(lngLat).setHTML(html).addTo(map)
    popupRef.current = popup

    // Only parcels (sector-plan-fill) are ticket-backed — roads/boundaries never have one.
    const rawId =
      feature.layer.id === 'sector-plan-fill' ? (feature.id ?? feature.properties?.id) : undefined
    const sectorPlanId = typeof rawId === 'number' ? rawId : Number(rawId)
    if (!Number.isInteger(sectorPlanId)) return

    popupParcelIdRef.current = sectorPlanId
    fetch(`/api/tickets/by-parcel/${sectorPlanId}`)
      .then((r) => r.json())
      .then((data: { ticket: null | Parameters<typeof ticketRowsHtml>[0] }) => {
        // Discard if the user clicked elsewhere (or closed the popup) while this was in flight.
        if (popupRef.current !== popup || popupParcelIdRef.current !== sectorPlanId) return
        if (!data.ticket) return
        popup.setHTML(
          `<div style="font:13px system-ui;min-width:180px;color:#111827">${propertyRowsHtml(feature)}${ticketRowsHtml(data.ticket)}</div>`,
        )
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new MLMap({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: initialParcel ? [initialParcel.lng, initialParcel.lat] : CENTER,
      zoom: initialParcel ? 16 : INITIAL_ZOOM,
    })
    mapRef.current = map
    map.addControl(new NavigationControl(), 'top-right')

    let marker: Marker | null = null
    if (initialParcel) {
      marker = new Marker({ color: '#2563eb' })
        .setLngLat([initialParcel.lng, initialParcel.lat])
        .addTo(map)
    }

    map.on('load', () => {
      map.addSource('sector_plan', {
        type: 'vector',
        tiles: [`${location.origin}/api/tiles/sector_plan/{z}/{x}/{y}`],
        promoteId: 'id',
      })
      map.addSource('road', {
        type: 'vector',
        tiles: [`${location.origin}/api/tiles/road/{z}/{x}/{y}`],
        promoteId: 'id',
      })
      map.addSource('sector_boundary', {
        type: 'vector',
        tiles: [`${location.origin}/api/tiles/sector_boundary/{z}/{x}/{y}`],
        promoteId: 'id',
      })

      // Render order: sector_plan fill (bottom) -> roads -> boundaries (top)
      map.addLayer({
        id: 'sector-plan-fill',
        type: 'fill',
        source: 'sector_plan',
        'source-layer': 'sector_plan',
        paint: {
          'fill-color': matchExpr('class_group', CLASS_GROUP_COLORS, '#cbd5e1'),
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.95, 0.75],
        },
      })
      // Peripheral areas (outside any numbered sector) get a dashed accent
      // outline on top of their class fill, per user decision.
      map.addLayer({
        id: 'sector-plan-peripheral-outline',
        type: 'line',
        source: 'sector_plan',
        'source-layer': 'sector_plan',
        filter: ['==', ['get', 'sector_no'], null],
        paint: {
          'line-color': '#f97316',
          'line-width': 1.5,
          'line-dasharray': [2, 1.5],
        },
      })
      map.addLayer({
        id: 'road-line',
        type: 'line',
        source: 'road',
        'source-layer': 'road',
        paint: {
          'line-color': matchExpr('type', ROAD_TYPE_COLORS, '#78716c'),
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            1,
            16,
            ['max', 1, ['/', ['coalesce', ['get', 'row_width_m'], 6], 3]],
          ],
        },
      })
      map.addLayer({
        id: 'sector-boundary-line',
        type: 'line',
        source: 'sector_boundary',
        'source-layer': 'sector_boundary',
        paint: {
          'line-color': '#111827',
          'line-width': 2,
        },
      })

      // Invisible hit-target covering each sector's full boundary polygon
      // (near-zero, not exactly-zero, opacity so it still paints and stays
      // hit-testable). This is what "hovering/clicking a sector" actually
      // means -- unlike sector-plan-fill it has no gaps between parcels, so
      // the whole sector area is consistently interactive.
      map.addLayer({
        id: 'sector-hit-target',
        type: 'fill',
        source: 'sector_boundary',
        'source-layer': 'sector_boundary',
        paint: { 'fill-color': '#000000', 'fill-opacity': 0.01 },
      })

      const NO_MATCH: FilterSpecification = ['==', ['get', 'sector_no'], -1]

      // Whole-sector hover highlight (amber) -- filter-driven rather than
      // per-feature feature-state, since a sector spans hundreds of small
      // sector_plan parcels that would be expensive to track individually.
      map.addLayer({
        id: 'sector-hover-fill',
        type: 'fill',
        source: 'sector_boundary',
        'source-layer': 'sector_boundary',
        filter: NO_MATCH,
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.15 },
      })
      map.addLayer({
        id: 'sector-hover-outline',
        type: 'line',
        source: 'sector_boundary',
        'source-layer': 'sector_boundary',
        filter: NO_MATCH,
        paint: { 'line-color': '#f59e0b', 'line-width': 2.5, 'line-opacity': 0.95 },
      })
      // That sector's roads pick up the same accent on hover, without
      // filtering/hiding the rest of the road network.
      map.addLayer({
        id: 'road-hover-highlight',
        type: 'line',
        source: 'road',
        'source-layer': 'road',
        filter: NO_MATCH,
        paint: { 'line-color': '#f59e0b', 'line-width': 4, 'line-opacity': 0.85 },
      })
      // Selected-sector outline (blue) -- sector-plan-fill/road-line are
      // already filtered down to just this sector elsewhere; this outline
      // is the extra visual anchor for which one that is.
      map.addLayer({
        id: 'sector-selected-outline',
        type: 'line',
        source: 'sector_boundary',
        'source-layer': 'sector_boundary',
        filter: NO_MATCH,
        paint: { 'line-color': '#2563eb', 'line-width': 3.5, 'line-opacity': 1 },
      })

      function setHoverFilter(sectorNo: number | null) {
        const filter: FilterSpecification =
          sectorNo === null ? NO_MATCH : ['==', ['get', 'sector_no'], sectorNo]
        map.setFilter('sector-hover-fill', filter)
        map.setFilter('sector-hover-outline', filter)
        map.setFilter('road-hover-highlight', filter)
      }

      map.on('mousemove', 'sector-hit-target', (e: MapLayerMouseEvent) => {
        const raw = e.features?.[0]?.properties?.sector_no
        const sectorNo = typeof raw === 'number' ? raw : null
        if (hoveredSectorRef.current !== sectorNo) {
          hoveredSectorRef.current = sectorNo
          setHoverFilter(sectorNo)
        }
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'sector-hit-target', () => {
        hoveredSectorRef.current = null
        setHoverFilter(null)
        map.getCanvas().style.cursor = ''
      })

      // Single map-wide click handler drives selection: clicking any
      // feature inside a sector (a parcel, a road, or just bare sector
      // area via the hit-target) selects that sector everywhere -- the
      // dropdown, the map filter/fly-to, and the Stats panel all key off
      // the same selectedSector state. Clicking outside every sector
      // deselects back to "All sectors".
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ['sector-plan-fill', 'road-line', 'sector-hit-target'],
        })
        if (hits.length === 0) {
          setSelectedSector('all')
          popupRef.current?.remove()
          popupParcelIdRef.current = null
          return
        }
        const detail =
          hits.find((f) => f.layer.id === 'sector-plan-fill' || f.layer.id === 'road-line') ??
          hits[0]
        const raw = detail.properties?.sector_no
        setSelectedSector(typeof raw === 'number' ? raw : 'all')
        showPopup(map, detail as unknown as MapGEOJSONFeatureCompat, e.lngLat)
      })
    })

    return () => {
      marker?.remove()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial-view-only prop, map is created once
  }, [])

  // Layer visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    ;(
      [
        ['sector-plan-fill', visibility.sector_plan],
        ['sector-plan-peripheral-outline', visibility.sector_plan],
        ['road-line', visibility.road],
        ['road-hover-highlight', visibility.road],
        ['sector-boundary-line', visibility.sector_boundary],
        ['sector-hover-fill', visibility.sector_boundary],
        ['sector-hover-outline', visibility.sector_boundary],
        ['sector-selected-outline', visibility.sector_boundary],
      ] as const
    ).forEach(([id, visible]) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
      }
    })
  }, [visibility])

  // Opacity
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('sector-plan-fill')) return
    map.setPaintProperty('sector-plan-fill', 'fill-opacity', opacity.sector_plan)
    map.setPaintProperty('road-line', 'line-opacity', opacity.road)
    map.setPaintProperty('sector-boundary-line', 'line-opacity', opacity.sector_boundary)
  }, [opacity])

  // Sector filter (also drives fly-to when a single sector is chosen)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('sector-plan-fill')) return

    const sectorFilter =
      selectedSector === 'all' ? null : ['==', ['get', 'sector_no'], selectedSector]

    const classCondition =
      classFilter === 'all' ? null : ['==', ['get', 'class_group'], classFilter]

    const combined = [sectorFilter, classCondition].filter(Boolean) as unknown[]
    const finalFilter =
      combined.length === 0 ? null : combined.length === 1 ? combined[0] : ['all', ...combined]

    map.setFilter('sector-plan-fill', finalFilter as FilterSpecification | null)
    map.setFilter('road-line', sectorFilter as FilterSpecification | null)

    if (map.getLayer('sector-selected-outline')) {
      map.setFilter(
        'sector-selected-outline',
        (selectedSector === 'all'
          ? ['==', ['get', 'sector_no'], -1]
          : ['==', ['get', 'sector_no'], selectedSector]) as FilterSpecification,
      )
    }

    if (selectedSector !== 'all') {
      const s = sectors.find((x) => x.sector_no === selectedSector)
      if (s) {
        map.fitBounds(
          [
            [s.xmin, s.ymin],
            [s.xmax, s.ymax],
          ],
          { padding: 60, duration: 800 },
        )
      }
    }
  }, [selectedSector, classFilter, sectors])

  const classGroups = Object.keys(CLASS_GROUP_COLORS)
  const filteredSectors = search.trim()
    ? sectors.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : sectors

  function goToSearch() {
    if (filteredSectors.length > 0) {
      setSelectedSector(filteredSectors[0].sector_no)
    }
  }

  const layerRows: Array<{
    key: 'sector_plan' | 'road' | 'sector_boundary'
    label: string
  }> = [
    { key: 'sector_plan', label: 'Sector plan' },
    { key: 'road', label: 'Roads' },
    { key: 'sector_boundary', label: 'Boundaries' },
  ]

  return (
    <div className="kumbh-map relative h-screen w-full">
      <div ref={mapContainer} className="h-full w-full" />

      <Panel
        icon={<CompassIcon className="h-full w-full" />}
        title="Kumbh Mela"
        subtitle="Sector plan · Haridwar–Rishikesh"
        side="left"
      >
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <SearchIcon className="h-3.5 w-3.5" />
              Search sector
            </div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') goToSearch()
                }}
                placeholder="e.g. Rishikesh"
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
          </div>

          {/* Sector + class filters */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <LayersIcon className="h-3.5 w-3.5" />
                Sector
              </label>
              <select
                value={selectedSector}
                onChange={(e) =>
                  setSelectedSector(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 outline-none transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              >
                <option value="all">All sectors</option>
                {filteredSectors.map((s) => (
                  <option key={s.sector_no} value={s.sector_no}>
                    {s.sector_no}. {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <TagIcon className="h-3.5 w-3.5" />
                Class
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 outline-none transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              >
                <option value="all">All classes</option>
                {classGroups.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Layers */}
          <div className="border-t border-slate-100 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Layers
            </div>
            <div className="flex flex-col gap-2.5">
              {layerRows.map(({ key, label }) => (
                <div
                  key={key}
                  className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-slate-800">{label}</span>
                    <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={visibility[key]}
                        onChange={(e) => setVisibility((v) => ({ ...v, [key]: e.target.checked }))}
                      />
                      <span className="absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40" />
                      <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                    </label>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={opacity[key]}
                      onChange={(e) => setOpacity((o) => ({ ...o, [key]: Number(e.target.value) }))}
                      className="kumbh-range h-1 w-full cursor-pointer"
                    />
                    <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                      {Math.round(opacity[key] * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-slate-100 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Legend
            </div>
            <div className="grid grid-cols-1 gap-1">
              {classGroups.map((c) => (
                <div key={c} className="flex items-center gap-2 text-[12.5px] text-slate-700">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: CLASS_GROUP_COLORS[c] }}
                  />
                  {c}
                </div>
              ))}
              <div className="flex items-center gap-2 text-[12.5px] text-slate-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border-[1.5px] border-dashed border-orange-500" />
                Peripheral (outside numbered sectors)
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {showStats && (
        <StatsPanel
          icon={<ChartBarIcon className="h-full w-full" />}
          onClose={() => setShowStats(false)}
          sectorNo={selectedSector === 'all' ? null : selectedSector}
          sectorLabel={
            selectedSector !== 'all'
              ? (() => {
                  const s = sectors.find((x) => x.sector_no === selectedSector)
                  return s ? `${s.sector_no}. ${s.name}` : `Sector ${selectedSector}`
                })()
              : undefined
          }
          onClearSector={() => setSelectedSector('all')}
        />
      )}

      {!showStats && (
        <button
          onClick={() => setShowStats(true)}
          aria-label="Show stats panel"
          className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-xl border border-slate-900/8 bg-white/92 px-3 py-2 text-[12.5px] font-medium text-slate-700 shadow-[0_8px_30px_rgba(15,23,42,0.14)] backdrop-blur-md transition-colors hover:bg-white cursor-pointer"
        >
          <ChartBarIcon className="h-4 w-4" />
          Stats
        </button>
      )}
    </div>
  )
}

// MapLibre's typed feature from map events isn't exactly MapGeoJSONFeature
// in all versions; keep the popup helper loosely typed against the shape we use.
type MapGEOJSONFeatureCompat = {
  id?: number | string
  properties?: Record<string, unknown>
  layer: { id: string }
}
