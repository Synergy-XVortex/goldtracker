import type { Session } from '@supabase/supabase-js'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface AuthState {
  /** False until the stored session (or the link in the URL) has been read. */
  ready: boolean
  session: Session | null
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: false, session: null })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ ready: true, session: data.session })
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ ready: true, session })
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
