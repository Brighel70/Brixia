import React, { createContext, useContext, useState, useCallback } from 'react'

interface CreatePersonNavContextValue {
  nextPersonId: string | null
  prevPersonId: string | null
  setCreatePersonNav: (next: string | null, prev: string | null) => void
}

const CreatePersonNavContext = createContext<CreatePersonNavContextValue | null>(null)

export function CreatePersonNavProvider({ children }: { children: React.ReactNode }) {
  const [nextPersonId, setNext] = useState<string | null>(null)
  const [prevPersonId, setPrev] = useState<string | null>(null)
  const setCreatePersonNav = useCallback((next: string | null, prev: string | null) => {
    setNext(next)
    setPrev(prev)
  }, [])
  return (
    <CreatePersonNavContext.Provider value={{ nextPersonId, prevPersonId, setCreatePersonNav }}>
      {children}
    </CreatePersonNavContext.Provider>
  )
}

export function useCreatePersonNav() {
  const ctx = useContext(CreatePersonNavContext)
  return ctx ?? { nextPersonId: null, prevPersonId: null, setCreatePersonNav: () => {} }
}
