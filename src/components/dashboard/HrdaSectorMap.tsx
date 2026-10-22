'use client'

import { MapContainer, Polygon, Popup, TileLayer } from 'react-leaflet'
import Link from 'next/link'
import 'leaflet/dist/leaflet.css'
import { useT } from '@/i18n/client'

type Sector = {
  key: string
  sectorNo: number
  name: string
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
  color: string
  count: number
  openCount: number
  geometry?:
    | {
        type: 'Polygon'
        coordinates: [number, number][][]
      }
    | {
        type: 'MultiPolygon'
        coordinates: [number, number][][][]
      }
}

function polygonPositions(sector: Sector) {
  if (!sector.geometry) return []
  const rings =
    sector.geometry.type === 'Polygon' ? [sector.geometry.coordinates] : sector.geometry.coordinates
  return rings.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
    ),
  )
}

function sectorLabel(sector: Sector) {
  const name = sector.name.replace(/-\d+$/, '').replace(/[-_]+/g, ' ').trim().toUpperCase()
  return `${String(sector.sectorNo).padStart(2, '0')}. ${name}`
}

export function HrdaSectorMap({ sectors, canFilter }: { sectors: Sector[]; canFilter: boolean }) {
  const t = useT()
  return (
    <MapContainer
      center={[29.945, 78.16]}
      zoom={12}
      scrollWheelZoom
      className="h-full min-h-[240px] w-full sm:min-h-[320px]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sectors.map((sector) => (
        <Polygon
          key={sector.key}
          positions={polygonPositions(sector)}
          pathOptions={{
            color: sector.color,
            fillColor: sector.color,
            fillOpacity: 0.22,
            weight: 2,
          }}
        >
          <Popup>
            <div className="hrda-sector-popup">
              <div className="hrda-sector-popup__heading">
                <span className="hrda-sector-popup__eyebrow">{t('HRDA SECTOR')}</span>
                <strong>{sectorLabel(sector)}</strong>
              </div>
              <div className="hrda-sector-popup__kpis">
                <div>
                  <span>{t('Total')}</span>
                  <strong>{sector.count}</strong>
                </div>
                <div>
                  <span>{t('Open')}</span>
                  <strong className="is-open">{sector.openCount}</strong>
                </div>
                <div>
                  <span>{t('Resolved')}</span>
                  <strong className="is-done">{sector.count - sector.openCount}</strong>
                </div>
              </div>
              <div className="hrda-sector-popup__progress">
                <div className="hrda-sector-popup__progress-label">
                  <span>{t('Resolution progress')}</span>
                  <strong>
                    {sector.count
                      ? Math.round(((sector.count - sector.openCount) / sector.count) * 100)
                      : 0}
                    %
                  </strong>
                </div>
                <div className="hrda-sector-popup__track">
                  <div
                    className="hrda-sector-popup__fill"
                    style={{
                      width: `${sector.count ? ((sector.count - sector.openCount) / sector.count) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <Link
                href={`/tickets?sector=${encodeURIComponent(sector.key)}`}
                className="hrda-sector-popup__link"
              >
                {t('View area tickets')} <span aria-hidden>→</span>
              </Link>
              {!canFilter && (
                <span className="hrda-sector-popup__note">
                  {t('Surveyor view is limited to your assigned tickets.')}
                </span>
              )}
            </div>
          </Popup>
        </Polygon>
      ))}
    </MapContainer>
  )
}
