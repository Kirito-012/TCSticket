import Link from 'next/link'
import { Sparkles, ShieldCheck, Zap, Users } from 'lucide-react'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left — brand panel */}
      <div className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden border-r border-border bg-background-elevated p-10 lg:flex">
        <div className="bg-glow pointer-events-none absolute inset-0" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent shadow-[0_0_20px_-4px_rgba(16,185,129,0.7)]">
            <Sparkles className="h-4.5 w-4.5 text-black" strokeWidth={2.25} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            TheCraftSync
          </span>
        </div>

        <div className="relative max-w-md space-y-8">
          <blockquote className="space-y-4">
            <p className="text-2xl font-medium leading-snug tracking-tight text-foreground">
              &ldquo;Our first-response time dropped from 40 minutes to under 3. This is the first
              helpdesk our agents actually enjoy using.&rdquo;
            </p>
            <footer className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-soft text-xs font-semibold text-violet">
                RK
              </span>
              <div className="text-sm">
                <p className="font-medium text-foreground">Riya Kapoor</p>
                <p className="text-muted">Head of Support, Northwind</p>
              </div>
            </footer>
          </blockquote>

          <div className="grid grid-cols-3 gap-4 border-t border-border pt-6">
            <div className="flex items-start gap-2.5">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
              <p className="text-xs leading-snug text-muted">Realtime updates, zero refresh</p>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
              <p className="text-xs leading-snug text-muted">SSO, 2FA & audit trails</p>
            </div>
            <div className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
              <p className="text-xs leading-snug text-muted">Built for busy support teams</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-muted">© 2026 TheCraftSync. All rights reserved.</p>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Sparkles className="h-4.5 w-4.5 text-black" strokeWidth={2.25} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              TheCraftSync
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted">Sign in to your workspace to continue</p>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-strong bg-white/[0.03] text-sm font-medium text-muted-strong transition-colors hover:bg-white/[0.07] hover:text-foreground"
            >
              <GoogleIcon className="h-4 w-4" />
              Google
            </button>
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-strong bg-white/[0.03] text-sm font-medium text-muted-strong transition-colors hover:bg-white/[0.07] hover:text-foreground"
            >
              <MicrosoftIcon className="h-4 w-4" />
              Microsoft
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">or continue with email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-sm text-muted">
            New to TheCraftSync?{' '}
            <Link href="/register" className="font-medium text-accent-strong hover:text-accent">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6.02-2.74-6.02-6.2S8.19 5.8 11.5 5.8c1.89 0 3.16.8 3.88 1.5l2.65-2.55C16.36 3.06 14.13 2 11.5 2 6.53 2 2.5 6.03 2.5 11s4.03 9 9 9c5.19 0 8.63-3.65 8.63-8.79 0-.59-.06-1.04-.14-1.49H12z"
      />
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}
