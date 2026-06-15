'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log('LOGIN ERROR:', error)
    console.log('LOGIN DATA:', data)

    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      const message =
        'No se pudo confirmar la sesión. Intenta iniciar sesión nuevamente.'
      toast.error(message)
      setError(message)
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', sessionData.session.user.id)
      .single()

    console.log('PROFILE:', profile)
    console.log('PROFILE ERROR:', profileError)

    setLoading(false)
    window.location.href = '/dashboard'
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900">Acceso Residencial</h1>
        <p className="mt-2 text-sm text-slate-500">
          Ingresa para anunciar visitas o validar accesos.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">
              Correo
            </span>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">
              Contraseña
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 pr-12 text-slate-900 outline-none"
                required
              />
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  setShowPassword(!showPassword)
                }}
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </label>

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  )
}
