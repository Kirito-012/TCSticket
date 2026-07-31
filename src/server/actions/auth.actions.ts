'use server'

import { AuthError } from 'next-auth'
import { signIn, signOut } from '@/server/auth/auth'

export type LoginState = { error?: string } | undefined

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password.' }
        default:
          return { error: 'Something went wrong. Please try again.' }
      }
    }
    // NEXT_REDIRECT is thrown on success — let it propagate.
    throw error
  }
}

export async function logout() {
  await signOut({ redirectTo: '/login' })
}
