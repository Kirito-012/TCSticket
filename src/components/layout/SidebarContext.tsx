'use client'

import { createContext, useContext, useState } from 'react'

const SidebarContext = createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  /** True for Surveyors: the simple, big-text layout (no search, bell or menu drawer). */
  simple: boolean
  /** True when the simple layout also uses the light theme (Surveyors only). */
  light: boolean
} | null>(null)

export function SidebarProvider({
  children,
  simple = false,
  light = false,
}: {
  children: React.ReactNode
  simple?: boolean
  light?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <SidebarContext.Provider value={{ open, setOpen, simple, light }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
