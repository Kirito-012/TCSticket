/**
 * The four Kumbh zones and which sectors each one holds (from the "Kumbh Lands Sector Wise"
 * sheet). A Zone Inspector looks after one zone; a Nodal Manager looks after one sector.
 *
 * The sector numbers match the sectors in the map database (sector 1 .. 32). The sheet's "Peripheral
 * Parking" list belongs to Zone 4 but has no sector number, so it is not here.
 */

export type ZoneKey = 'zone-1' | 'zone-2' | 'zone-3' | 'zone-4'

export type Zone = {
  key: ZoneKey
  name: string
  /** Sector numbers in this zone, in the order of the sheet. */
  sectorNos: number[]
}

export const ZONES: readonly Zone[] = [
  { key: 'zone-1', name: 'Zone 1', sectorNos: [1, 2, 3, 4, 5, 6] },
  { key: 'zone-2', name: 'Zone 2', sectorNos: [7, 8, 9, 10, 15, 16, 17, 18, 24] },
  { key: 'zone-3', name: 'Zone 3', sectorNos: [11, 12, 13, 14] },
  {
    key: 'zone-4',
    name: 'Zone 4',
    sectorNos: [19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 32],
  },
]

export function isZoneKey(value: unknown): value is ZoneKey {
  return ZONES.some((z) => z.key === value)
}

export function zoneByKey(key: string | null | undefined): Zone | null {
  return ZONES.find((z) => z.key === key) ?? null
}

/** The key a sector is stored under on tickets and users: `kumbh-sector-<number>`. */
export function sectorKeyOf(sectorNo: number): string {
  return `kumbh-sector-${sectorNo}`
}

/** The sector number inside a sector key, or null if it is not one. */
export function sectorNoOf(sectorKey: string | null | undefined): number | null {
  const match = /^kumbh-sector-(\d{1,3})$/.exec(sectorKey ?? '')
  return match ? Number(match[1]) : null
}

export function zoneOfSectorNo(sectorNo: number): Zone | null {
  return ZONES.find((z) => z.sectorNos.includes(sectorNo)) ?? null
}

export function zoneOfSectorKey(sectorKey: string | null | undefined): Zone | null {
  const no = sectorNoOf(sectorKey)
  return no === null ? null : zoneOfSectorNo(no)
}

/** Every sector key inside a zone (empty for an unknown zone). */
export function sectorKeysOfZone(zoneKey: string | null | undefined): string[] {
  return (zoneByKey(zoneKey)?.sectorNos ?? []).map(sectorKeyOf)
}

/**
 * "BAHADRABAD-01" -> "Bahadrabad", "MUNNI-KI-RETI-25" -> "Munni Ki Reti": the sector's name as
 * people say it, without the number the map database adds.
 */
export function prettySectorName(raw: string): string {
  return raw
    .replace(/[-\s]+\d+$/, '')
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
