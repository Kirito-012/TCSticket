import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from '@/server/auth/auth'
import { defineAbilityFor } from '@/server/auth/ability'

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
