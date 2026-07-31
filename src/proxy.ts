import NextAuth from 'next-auth'
import { authConfig } from '@/server/auth/auth.config'

// Lightweight NextAuth instance (no providers, no mongoose/bcrypt) purely for decoding the
// JWT session cookie on every request and running the `authorized` redirect logic.
const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  // Run on everything except static assets, image optimization, and API auth routes.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
