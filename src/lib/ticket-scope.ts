import { sectorKeysOfZone } from './zones'

/**
 * Which tickets a person may see. It follows their role:
 *  - Admin: everything.
 *  - Zone Inspector: tickets in the sectors of their zone.
 *  - Nodal Manager: tickets in their own sector.
 *  - Surveyor: only the tickets assigned to them.
 * Anyone with a zone or sector role who has not been given a zone or sector sees nothing.
 */
export type TicketScope =
  | { kind: 'all' }
  | { kind: 'sectors'; level: 'zone' | 'sector'; sectorKeys: string[] }
  | { kind: 'own'; assigneeId: string }

export const SEES_EVERYTHING: TicketScope = { kind: 'all' }

type ScopeUser = { id: string; sectorKey?: string | null; zoneKey?: string | null }

/** Works out the scope from what the person's role allows and where they have been placed. */
export function scopeFor(user: ScopeUser, grants: string[]): TicketScope {
  const can = (grant: string) => grants.includes(grant)
  if (can('ticket:read:all')) return SEES_EVERYTHING
  if (can('ticket:read:zone')) {
    return { kind: 'sectors', level: 'zone', sectorKeys: sectorKeysOfZone(user.zoneKey) }
  }
  if (can('ticket:read:sector')) {
    return { kind: 'sectors', level: 'sector', sectorKeys: user.sectorKey ? [user.sectorKey] : [] }
  }
  return { kind: 'own', assigneeId: user.id }
}

/** Whether a ticket in this sector, held by this assignee, is inside the scope. */
export function scopeAllows(
  scope: TicketScope,
  ticket: { sectorKey?: string | null; assigneeId?: string | null },
): boolean {
  if (scope.kind === 'all') return true
  if (scope.kind === 'own') return ticket.assigneeId === scope.assigneeId
  return !!ticket.sectorKey && scope.sectorKeys.includes(ticket.sectorKey)
}

/** Whether a person may be given a ticket by someone with this scope. */
export function scopeAllowsAssignee(
  scope: TicketScope,
  assignee: { sectorKey?: string | null; zoneKey?: string | null } | null,
): boolean {
  if (scope.kind === 'all') return true
  if (scope.kind === 'own') return false
  if (!assignee) return true // un-assigning is always fine inside your own scope
  const keys = new Set(scope.sectorKeys)
  if (assignee.sectorKey && keys.has(assignee.sectorKey)) return true
  // A zone inspector's own zone counts too, so a ticket can go up to them.
  return (
    scope.level === 'zone' &&
    !!assignee.zoneKey &&
    sectorKeysOfZone(assignee.zoneKey).some((k) => keys.has(k))
  )
}

/** The kind of scope as plain words, for headings. */
export function scopeLevel(scope: TicketScope): 'all' | 'zone' | 'sector' | 'own' {
  if (scope.kind === 'sectors') return scope.level
  return scope.kind
}
