import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'TheCraftSync',
  description: 'A modern, premium helpdesk & ticketing system.',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The Light/Dark choice for Admins and Managers is remembered in a cookie so the very first
  // paint is already in the right theme.
  const theme = (await cookies()).get('theme')?.value === 'light' ? 'theme-light' : ''

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark ${theme} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  )
}
