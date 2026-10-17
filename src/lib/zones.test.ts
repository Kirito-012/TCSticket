import { describe, expect, it } from 'vitest'
import {
  ZONES,
  prettySectorName,
  sectorKeyOf,
  sectorKeysOfZone,
  sectorNoOf,
  zoneOfSectorKey,
  zoneOfSectorNo,
} from './zones'

describe('zones', () => {
  it('has four zones', () => {
    expect(ZONES.map((z) => z.key)).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4'])
  })

  it('puts every sector 1..32 in exactly one zone', () => {
    const all = ZONES.flatMap((z) => z.sectorNos).sort((a, b) => a - b)
    expect(all).toEqual(Array.from({ length: 32 }, (_, i) => i + 1))
  })

  it('follows the sheet', () => {
    expect(zoneOfSectorNo(1)?.key).toBe('zone-1')
    expect(zoneOfSectorNo(6)?.key).toBe('zone-1')
    expect(zoneOfSectorNo(7)?.key).toBe('zone-2') // Gauri Shankar starts Zone 2
    expect(zoneOfSectorNo(24)?.key).toBe('zone-2') // Motichur ends Zone 2
    expect(zoneOfSectorNo(11)?.key).toBe('zone-3') // Bairagi Camp
    expect(zoneOfSectorNo(14)?.key).toBe('zone-3') // Laaljiwala
    expect(zoneOfSectorNo(19)?.key).toBe('zone-4') // Mansa Devi
    expect(zoneOfSectorNo(32)?.key).toBe('zone-4') // Neelkanth
  })

  it('turns sector numbers into keys and back', () => {
    expect(sectorKeyOf(9)).toBe('kumbh-sector-9')
    expect(sectorNoOf('kumbh-sector-9')).toBe(9)
    expect(sectorNoOf('haridwar-north')).toBeNull()
    expect(sectorNoOf(null)).toBeNull()
  })

  it('finds the zone of a sector key', () => {
    expect(zoneOfSectorKey('kumbh-sector-15')?.key).toBe('zone-2')
    expect(zoneOfSectorKey('nonsense')).toBeNull()
  })

  it('lists the sector keys of a zone', () => {
    expect(sectorKeysOfZone('zone-3')).toEqual([
      'kumbh-sector-11',
      'kumbh-sector-12',
      'kumbh-sector-13',
      'kumbh-sector-14',
    ])
    expect(sectorKeysOfZone('zone-9')).toEqual([])
    expect(sectorKeysOfZone(null)).toEqual([])
  })

  it('makes sector names readable', () => {
    expect(prettySectorName('BAHADRABAD-01')).toBe('Bahadrabad')
    expect(prettySectorName('MUNNI-KI-RETI-25')).toBe('Munni Ki Reti')
    expect(prettySectorName('Gauri Shankar')).toBe('Gauri Shankar')
  })
})
