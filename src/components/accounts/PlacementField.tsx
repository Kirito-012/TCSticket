'use client'

import { useState } from 'react'
import { Select } from '@/components/ui/Select'
import { placementKindOf, ZONE_OPTIONS } from '@/lib/placement'

export type SectorChoice = { value: string; label: string }

/**
 * Asks where someone works, as far as their role needs it: a sector for a Surveyor or Nodal
 * Manager, a zone for a Zone Inspector, nothing for an Admin. Submits as `sectorNo` / `zoneKey`.
 */
export function PlacementField({
  roleKey,
  sectors,
  size = 'md',
}: {
  roleKey: string
  sectors: SectorChoice[]
  size?: 'sm' | 'md' | 'lg'
}) {
  const kind = placementKindOf(roleKey)
  const [sectorNo, setSectorNo] = useState('')
  const [zoneKey, setZoneKey] = useState('')
  if (kind === null) return null

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-strong">
        {kind === 'sector' ? 'Which sector?' : 'Which zone?'}
      </label>
      {kind === 'sector' ? (
        <Select
          name="sectorNo"
          value={sectorNo}
          onChange={setSectorNo}
          size={size}
          placeholder="Choose a sector"
          options={sectors}
        />
      ) : (
        <Select
          name="zoneKey"
          value={zoneKey}
          onChange={setZoneKey}
          size={size}
          placeholder="Choose a zone"
          options={ZONE_OPTIONS}
        />
      )}
    </div>
  )
}
