import { NextRequest } from 'next/server'
import { getPool } from '@/server/db/postgres'

export const runtime = 'nodejs'

// Whitelist of layer -> (table, MVT layer name, columns). Never interpolate
// the layer param straight into SQL.
const LAYERS: Record<string, { table: string; columns: string }> = {
  road: {
    table: 'kumbh.road',
    columns: 'id, road_name, type, row_width_m, sector_no, kumbh_land',
  },
  sector_boundary: {
    table: 'kumbh.sector_boundary',
    columns: 'id, name, sector_no, area_hac',
  },
  sector_plan: {
    table: 'kumbh.sector_plan',
    columns: 'id, class, class_group, subclass, plot_no, block, sector_no, label, area',
  },
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> },
) {
  const { layer, z, x, y } = await params
  const def = LAYERS[layer]
  if (!def) {
    return new Response(`Unknown layer: ${layer}`, { status: 404 })
  }

  const zi = Number(z)
  const xi = Number(x)
  const yi = Number(y)
  if (![zi, xi, yi].every(Number.isInteger)) {
    return new Response('Invalid tile coordinates', { status: 400 })
  }

  const sql = `
    SELECT ST_AsMVT(t, $1, 4096, 'geom') AS mvt FROM (
      SELECT ${def.columns},
             ST_AsMVTGeom(
               ST_Transform(geom, 3857),
               ST_TileEnvelope($2, $3, $4),
               4096, 64, true
             ) AS geom
      FROM ${def.table}
      WHERE geom && ST_Transform(ST_TileEnvelope($2, $3, $4, margin => (64.0 / 4096)), 4326)
    ) t;
  `

  const pool = getPool()
  const { rows } = await pool.query(sql, [layer, zi, xi, yi])
  const mvt: Buffer | null = rows[0]?.mvt ?? null

  return new Response(new Uint8Array(mvt ?? Buffer.alloc(0)), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.mapbox-vector-tile',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate',
    },
  })
}
