import React, { createContext, useContext, useState, useCallback } from 'react'

interface PageTitleContextValue {
  title: string | null
  setTitle: (title: string | null) => void
}

const PageTitleContext = createContext<PageTitleContextValue | null>(null)

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitleState] = useState<string | null>(null)
  const setTitle = useCallback((t: string | null) => setTitleState(t), [])
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  )
}

export function usePageTitle() {
  const ctx = useContext(PageTitleContext)
  return ctx?.title ?? null
}

export function useSetPageTitle() {
  const ctx = useContext(PageTitleContext)
  return ctx?.setTitle ?? (() => {})
}
