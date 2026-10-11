import { Pool } from 'pg'

export type SectorGeometry =
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] }

export type Sector = {
  key: string
  sectorNo: number
  name: string
  zone: string | null
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
  color: string
  geometry?: SectorGeometry
}

type SectorRow = {
  sector_no: number
  name: string | null
  zone: string | null
  geom?: SectorGeometry
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

const COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee']
let pool: Pool | null = null

function getPool() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is required to load Kumbh sector boundaries')
  }
  pool ??= new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 4,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  })
  return pool
}

function sectorKey(sectorNo: number) {
  return `kumbh-sector-${sectorNo}`
}

function toSector(row: SectorRow): Sector {
  return {
    key: sectorKey(row.sector_no),
    sectorNo: row.sector_no,
    name: row.name ?? `Sector ${row.sector_no}`,
    zone: row.zone,
    minLatitude: Number(row.ymin),
    maxLatitude: Number(row.ymax),
    minLongitude: Number(row.xmin),
    maxLongitude: Number(row.xmax),
    color: COLORS[(row.sector_no - 1) % COLORS.length],
    ...(row.geom ? { geometry: row.geom } : {}),
  }
}

export async function getRealSectors(withGeometry = true): Promise<Sector[]> {
  const db = getPool()
  const geometry = withGeometry
    ? 'ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.00003), 6)::json AS geom,'
    : ''
  const { rows } = await db.query<SectorRow>(`
    SELECT sector_no, name, zone, ${geometry}
           ST_XMin(geom) AS xmin, ST_YMin(geom) AS ymin,
           ST_XMax(geom) AS xmax, ST_YMax(geom) AS ymax
      FROM kumbh.sector_boundary
     ORDER BY sector_no
  `)
  return rows.map(toSector)
}

/** Finds the authoritative sector containing a GPS point, including polygon boundaries. */
export async function findSector(latitude: number, longitude: number): Promise<Sector | null> {
  const { rows } = await getPool().query<SectorRow>(
    `SELECT sector_no, name, zone,
            ST_XMin(geom) AS xmin, ST_YMin(geom) AS ymin,
            ST_XMax(geom) AS xmax, ST_YMax(geom) AS ymax
       FROM kumbh.sector_boundary
      WHERE ST_Covers(
        geom,
        ST_SetSRID(ST_Point($1, $2), 4326)
      )
      ORDER BY sector_no
      LIMIT 1`,
    [longitude, latitude],
  )
  return rows[0] ? toSector(rows[0]) : null
}

export { sectorKey }
