import { describe, expect, it } from 'vitest'
import { placementKindOf, resolvePlacement } from './placement'

describe('placementKindOf', () => {
  it('knows what each role belongs to', () => {
    expect(placementKindOf('agent')).toBe('sector')
    expect(placementKindOf('manager')).toBe('sector')
    expect(placementKindOf('zoneinspector')).toBe('zone')
    expect(placementKindOf('admin')).toBeNull()
  })
})

describe('resolvePlacement', () => {
  it('places a surveyor or nodal manager in a sector', () => {
    expect(resolvePlacement('agent', { sectorNo: '7' })).toEqual({
      ok: true,
      placement: { sectorKey: 'kumbh-sector-7', zoneKey: null },
    })
    expect(resolvePlacement('manager', { sectorNo: 12 })).toEqual({
      ok: true,
      placement: { sectorKey: 'kumbh-sector-12', zoneKey: null },
    })
  })

  it('places a zone inspector in a zone', () => {
    expect(resolvePlacement('zoneinspector', { zoneKey: 'zone-3' })).toEqual({
      ok: true,
      placement: { sectorKey: null, zoneKey: 'zone-3' },
    })
  })

  it('drops whatever the role does not use', () => {
    expect(resolvePlacement('zoneinspector', { zoneKey: 'zone-1', sectorNo: 4 })).toMatchObject({
      placement: { sectorKey: null, zoneKey: 'zone-1' },
    })
    expect(resolvePlacement('manager', { sectorNo: 4, zoneKey: 'zone-1' })).toMatchObject({
      placement: { sectorKey: 'kumbh-sector-4', zoneKey: null },
    })
    expect(resolvePlacement('admin', { sectorNo: 4, zoneKey: 'zone-1' })).toEqual({
      ok: true,
      placement: { sectorKey: null, zoneKey: null },
    })
  })

  it('refuses a missing or invalid sector or zone', () => {
    expect(resolvePlacement('agent', {})).toEqual({ ok: false, error: 'Choose a sector' })
    expect(resolvePlacement('agent', { sectorNo: '99' })).toEqual({
      ok: false,
      error: 'Choose a sector',
    })
    expect(resolvePlacement('manager', { sectorNo: 'abc' })).toEqual({
      ok: false,
      error: 'Choose a sector',
    })
    expect(resolvePlacement('zoneinspector', { zoneKey: 'zone-9' })).toEqual({
      ok: false,
      error: 'Choose a zone',
    })
    expect(resolvePlacement('zoneinspector', {})).toEqual({ ok: false, error: 'Choose a zone' })
  })
})
