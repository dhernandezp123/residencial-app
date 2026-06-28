'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { PwaInstallHint } from '@/app/components/PwaInstallHint'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

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

    await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', sessionData.session.user.id)
      .single()

    setLoading(false)
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <Image
          src="/branding/logos/residentpass-lockup.svg"
          alt="ResidentPass"
          width={180}
          height={28}
          className="h-7 w-auto"
          unoptimized
        />
        <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Ingresa para anunciar visitas o validar accesos.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Correo
            </span>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-slate-900 dark:bg-slate-800 dark:text-white outline-none"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Contraseña
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-2xl border border-slate-300 dark:border-slate-600 px-4 py-3 pr-12 text-slate-900 dark:bg-slate-800 dark:text-white outline-none"
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
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
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
            <p className="rounded-xl bg-red-50 dark:bg-red-900/40 p-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#15936A] py-3 font-semibold text-white disabled:opacity-60 hover:bg-[#0E6B4E] transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-5 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            ¿Eres residente nuevo? Solicita tu enlace de registro a la administración de tu residencial.
          </p>
          <PwaInstallHint />
        </div>
      </div>
    </main>
  )
}
