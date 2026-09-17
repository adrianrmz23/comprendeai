import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { ArrowRight, BookOpen, Cloud, LockKeyhole, LogIn } from 'lucide-react'
import { getSupabaseBrowser, hasSupabaseBrowserConfig } from './supabaseBrowser'

type AuthContextValue = {
  user: User
  session: Session
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthGate')
  return value
}

export function AuthGate({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowser()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo<AuthContextValue | null>(() => {
    if (!session?.user || !supabase) return null
    return {
      user: session.user,
      session,
      signOut: async () => { await supabase.auth.signOut() },
    }
  }, [session, supabase])

  if (loading) {
    return <div className="auth-screen"><div className="auth-loading"><div className="auth-brand-mark">C</div><strong>Abriendo Comprende…</strong><span>Recuperando tu sesión segura.</span></div></div>
  }

  if (!hasSupabaseBrowserConfig() || !supabase) {
    return <div className="auth-screen"><section className="auth-card auth-config-card"><div className="auth-brand-mark">C</div><span className="auth-kicker"><Cloud size={15} /> CONFIGURACIÓN NECESARIA</span><h1>Conecta Supabase Auth.</h1><p>Comprende 1.4 usa un usuario real para sincronizar materiales, mapas y progreso entre dispositivos.</p><div className="auth-env-list"><code>VITE_SUPABASE_URL=...</code><code>VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...</code></div><small>También acepto tus nombres actuales <b>NEXT_PUBLIC_SUPABASE_URL</b> y <b>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</b>. La <b>SUPABASE_SECRET_KEY</b> sigue siendo exclusivamente del servidor.</small></section></div>
  }

  if (!session?.user || !value) {
    const submit = async (event: FormEvent) => {
      event.preventDefault()
      if (!email.trim() || !password) return
      setSubmitting(true)
      setError('')
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) setError(signInError.message)
      setSubmitting(false)
    }
    return <div className="auth-screen">
      <section className="auth-card">
        <div className="auth-logo-row"><div className="auth-brand-mark">C</div><div><strong>Comprende</strong><span>Tu sistema de estudio</span></div></div>
        <span className="auth-kicker"><LockKeyhole size={15} /> ACCESO PERSONAL</span>
        <h1>Continúa donde te quedaste.</h1>
        <p>Tu cuenta sincroniza materiales, mapas semánticos y memoria de aprendizaje sin compartirlos con otros usuarios del proyecto.</p>
        <form className="auth-form" onSubmit={submit}>
          <label><span>Correo</span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" /></label>
          <label><span>Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="primary-button auth-submit" disabled={submitting || !email.trim() || !password}><LogIn size={16} /> {submitting ? 'Entrando…' : 'Entrar'} <ArrowRight size={15} /></button>
        </form>
        <div className="auth-note"><BookOpen size={17} /><div><strong>Sin registro público.</strong><span>Crea tu usuario una sola vez desde Supabase → Authentication → Users.</span></div></div>
      </section>
    </div>
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
