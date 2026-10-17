import { ZONES, isZoneKey, sectorKeyOf, zoneOfSectorNo } from './zones'

/**
 * Where each role has to be placed: a Surveyor and a Nodal Manager belong to one sector, a Zone
 * Inspector to one zone, an Admin to neither.
 */
export type PlacementKind = 'sector' | 'zone' | null

export function placementKindOf(roleKey: string): PlacementKind {
  if (roleKey === 'agent' || roleKey === 'manager') return 'sector'
  if (roleKey === 'zoneinspector') return 'zone'
  return null
}

export type Placement = { sectorKey: string | null; zoneKey: string | null }

/**
 * Turns what a form sent (a sector number and/or a zone key) into the placement to store for this
 * role, or says what is wrong. Anything the role does not use is dropped, so a Zone Inspector can
 * never end up with a sector, or a Nodal Manager with a zone.
 */
export function resolvePlacement(
  roleKey: string,
  input: { sectorNo?: string | number | null; zoneKey?: string | null },
): { ok: true; placement: Placement } | { ok: false; error: string } {
  const kind = placementKindOf(roleKey)
  if (kind === null) return { ok: true, placement: { sectorKey: null, zoneKey: null } }

  if (kind === 'zone') {
    if (!isZoneKey(input.zoneKey)) return { ok: false, error: 'Choose a zone' }
    return { ok: true, placement: { sectorKey: null, zoneKey: input.zoneKey } }
  }

  const sectorNo = Number(input.sectorNo)
  if (!Number.isInteger(sectorNo) || !zoneOfSectorNo(sectorNo)) {
    return { ok: false, error: 'Choose a sector' }
  }
  return { ok: true, placement: { sectorKey: sectorKeyOf(sectorNo), zoneKey: null } }
}

/** The zones as options for a picker. */
export const ZONE_OPTIONS = ZONES.map((z) => ({ value: z.key, label: z.name }))
