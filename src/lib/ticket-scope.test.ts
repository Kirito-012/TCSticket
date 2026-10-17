import { describe, expect, it } from 'vitest'
import { scopeAllows, scopeAllowsAssignee, scopeFor } from './ticket-scope'

const ADMIN = ['ticket:read:all', 'ticket:assign']
const ZONE = ['ticket:read:zone', 'ticket:assign']
const NODAL = ['ticket:read:sector', 'ticket:assign']
const SURVEYOR = ['ticket:read:own']

describe('scopeFor', () => {
  it('lets an admin see everything', () => {
    expect(scopeFor({ id: 'a' }, ADMIN)).toEqual({ kind: 'all' })
  })

  it('limits a zone inspector to the sectors of their zone', () => {
    const scope = scopeFor({ id: 'z', zoneKey: 'zone-3' }, ZONE)
    expect(scope).toEqual({
      kind: 'sectors',
      level: 'zone',
      sectorKeys: ['kumbh-sector-11', 'kumbh-sector-12', 'kumbh-sector-13', 'kumbh-sector-14'],
    })
  })

  it('limits a nodal manager to their sector', () => {
    expect(scopeFor({ id: 'n', sectorKey: 'kumbh-sector-7' }, NODAL)).toEqual({
      kind: 'sectors',
      level: 'sector',
      sectorKeys: ['kumbh-sector-7'],
    })
  })

  it('shows nothing to a zone inspector or nodal manager who has not been placed', () => {
    expect(scopeFor({ id: 'z' }, ZONE)).toMatchObject({ sectorKeys: [] })
    expect(scopeFor({ id: 'n', sectorKey: null }, NODAL)).toMatchObject({ sectorKeys: [] })
  })

  it('limits a surveyor to their own tickets', () => {
    expect(scopeFor({ id: 's1' }, SURVEYOR)).toEqual({ kind: 'own', assigneeId: 's1' })
  })

  it('the widest grant wins', () => {
    expect(scopeFor({ id: 'x' }, [...NODAL, ...ADMIN])).toEqual({ kind: 'all' })
  })
})

describe('scopeAllows', () => {
  const zone2 = scopeFor({ id: 'z', zoneKey: 'zone-2' }, ZONE)

  it('allows tickets in the zone and refuses the rest', () => {
    expect(scopeAllows(zone2, { sectorKey: 'kumbh-sector-9' })).toBe(true)
    expect(scopeAllows(zone2, { sectorKey: 'kumbh-sector-1' })).toBe(false)
    expect(scopeAllows(zone2, { sectorKey: null })).toBe(false)
  })

  it('allows only the assigned tickets for a surveyor', () => {
    const scope = scopeFor({ id: 's1' }, SURVEYOR)
    expect(scopeAllows(scope, { assigneeId: 's1' })).toBe(true)
    expect(scopeAllows(scope, { assigneeId: 's2' })).toBe(false)
    expect(scopeAllows(scope, { assigneeId: null })).toBe(false)
  })

  it('allows everything for an admin', () => {
    expect(scopeAllows(scopeFor({ id: 'a' }, ADMIN), { sectorKey: null })).toBe(true)
  })
})

describe('scopeAllowsAssignee', () => {
  const nodal = scopeFor({ id: 'n', sectorKey: 'kumbh-sector-7' }, NODAL)
  const zone = scopeFor({ id: 'z', zoneKey: 'zone-2' }, ZONE)

  it('a nodal manager can hand tickets to people in their own sector only', () => {
    expect(scopeAllowsAssignee(nodal, { sectorKey: 'kumbh-sector-7' })).toBe(true)
    expect(scopeAllowsAssignee(nodal, { sectorKey: 'kumbh-sector-8' })).toBe(false)
    expect(scopeAllowsAssignee(nodal, { sectorKey: null })).toBe(false)
  })

  it('a zone inspector can hand tickets to people in any sector of the zone', () => {
    expect(scopeAllowsAssignee(zone, { sectorKey: 'kumbh-sector-24' })).toBe(true)
    expect(scopeAllowsAssignee(zone, { sectorKey: 'kumbh-sector-1' })).toBe(false)
  })

  it('anyone can take a ticket back (un-assign) inside their scope', () => {
    expect(scopeAllowsAssignee(nodal, null)).toBe(true)
  })

  it('a surveyor cannot hand tickets to anyone', () => {
    expect(
      scopeAllowsAssignee(scopeFor({ id: 's' }, SURVEYOR), { sectorKey: 'kumbh-sector-7' }),
    ).toBe(false)
  })
})
