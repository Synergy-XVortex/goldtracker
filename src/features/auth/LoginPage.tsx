import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from './AuthProvider'

type Step = { name: 'email' } | { name: 'code'; email: string }

const CODE_LENGTH = 6

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'

  const [step, setStep] = useState<Step>({ name: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to={redirectTo} replace />

  async function sendLink(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const normalisedEmail = email.trim().toLowerCase()
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalisedEmail,
      options: {
        // Accounts are created by invitation only.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    setPending(false)
    if (signInError) {
      setError(describeAuthError(signInError.message))
      return
    }
    setStep({ name: 'code', email: normalisedEmail })
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (step.name !== 'code') return
    setPending(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: step.email,
      token: code.trim(),
      type: 'email',
    })
    setPending(false)
    if (verifyError) {
      setError('Ce code est incorrect ou a expiré. Demandez un nouveau lien.')
      return
    }
    navigate(redirectTo, { replace: true })
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Connexion famille</h1>
        <p className="text-sm text-muted">
          L'accès au portefeuille est réservé aux membres invités. Les cours restent{' '}
          <Link to="/cours" className="font-semibold text-accent-ink underline">
            consultables sans compte
          </Link>
          .
        </p>
      </header>

      {step.name === 'email' ? (
        <form
          onSubmit={sendLink}
          className="flex flex-col gap-4 rounded-card border border-surface-line bg-surface p-4"
        >
          <label htmlFor="login-email" className="flex flex-col gap-1.5 text-sm font-semibold">
            Adresse e-mail
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-control border border-control-line bg-surface px-3 py-2.5 text-base font-normal outline-accent"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-control bg-accent px-4 py-3 font-bold text-on-accent disabled:opacity-60"
          >
            {pending ? 'Envoi…' : 'Recevoir un lien de connexion'}
          </button>
          {error && (
            <p role="alert" className="text-sm text-loss">
              {error}
            </p>
          )}
        </form>
      ) : (
        <form
          onSubmit={verifyCode}
          className="flex flex-col gap-4 rounded-card border border-surface-line bg-surface p-4"
        >
          <p className="text-sm">
            Un e-mail a été envoyé à <strong>{step.email}</strong>. Ouvrez le lien qu'il contient
            sur cet appareil, ou saisissez le code à {CODE_LENGTH} chiffres.
          </p>
          <label htmlFor="login-code" className="flex flex-col gap-1.5 text-sm font-semibold">
            Code reçu
            <input
              id="login-code"
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern={`[0-9]{${CODE_LENGTH}}`}
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className="rounded-control border border-control-line bg-surface px-3 py-2.5 font-mono text-lg tracking-[0.3em] outline-accent"
            />
          </label>
          <button
            type="submit"
            disabled={pending || code.length !== CODE_LENGTH}
            className="rounded-control bg-accent px-4 py-3 font-bold text-on-accent disabled:opacity-60"
          >
            {pending ? 'Vérification…' : 'Se connecter'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep({ name: 'email' })
              setCode('')
              setError(null)
            }}
            className="text-sm font-semibold text-muted underline"
          >
            Utiliser une autre adresse
          </button>
          {error && (
            <p role="alert" className="text-sm text-loss">
              {error}
            </p>
          )}
        </form>
      )}
    </main>
  )
}

/** Supabase answers "Signups not allowed" for addresses that were never invited. */
function describeAuthError(message: string): string {
  if (/signups not allowed|not allowed for otp/i.test(message)) {
    return "Cette adresse n'a pas été invitée. Demandez une invitation à l'administrateur de la famille."
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Trop de demandes. Patientez quelques minutes avant de redemander un lien.'
  }
  return "L'envoi a échoué. Vérifiez votre connexion puis réessayez."
}
