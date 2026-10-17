import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from '@/server/auth/auth'
import { defineAbilityFor } from '@/server/auth/ability'
import { dbConnect } from '@/server/db/connect'
import { UserModel } from '@/server/db/models/user.model'
import { scopeFor, type TicketScope } from '@/lib/ticket-scope'

/** Memoized per-request so repeated calls in the same render don't re-decode the session. */
export const getSession = cache(async () => auth())

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}

/** Redirects to /login if there's no session; otherwise returns the session's user. */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/**
 * Redirects to /login if unauthenticated, builds the caller's CASL ability from their
 * role grants, and — if a grant is given — redirects to /dashboard when they lack it.
 * Use this at the top of Server Actions, Route Handlers, and Server Components that
 * need an authorization check, not just an authentication check.
 */
export async function requireAbility(grant?: { action: string; subject: string }) {
  const user = await requireUser()
  const ability = defineAbilityFor(user.grants)

  if (grant && !ability.can(grant.action, grant.subject)) {
    redirect('/dashboard')
  }

  return { user, ability }
}

/** Where the signed-in person works (zone / sector), read fresh so a change applies at once. */
const getPlacement = cache(async (userId: string) => {
  await dbConnect()
  const doc = await UserModel.findById(userId).select('sectorKey zoneKey').lean()
  return { sectorKey: doc?.sectorKey ?? null, zoneKey: doc?.zoneKey ?? null }
})

/**
 * Ticket-list/dashboard visibility scoping, decided on the server (never just hidden in the UI):
 *  - `ticket:read:all` (Admin): everything.
 *  - `ticket:read:zone` (Zone Inspector): the tickets in the sectors of their zone.
 *  - `ticket:read:sector` (Nodal Manager): the tickets in their sector.
 *  - otherwise (Surveyor): only the tickets assigned to them.
 *
 * `scope` is the full answer. `forcedAssigneeId` is kept for the Surveyor screens: it is set only
 * for someone limited to their own tickets, and undefined for everyone else.
 */
export async function requireTicketScope() {
  // Every seeded role has *some* ticket:read:* grant, so this is authn-only, not authz-gated —
  // the scoping below is the actual access control.
  const { user, ability } = await requireAbility()
  const placement = await getPlacement(user.id)
  const scope: TicketScope = scopeFor({ id: user.id, ...placement }, user.grants)
  const forcedAssigneeId = scope.kind === 'own' ? scope.assigneeId : undefined
  return { user, ability, scope, placement, forcedAssigneeId }
}
