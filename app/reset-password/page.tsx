'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      setReady(Boolean(data.session))
    }

    void checkSession()
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Contraseña actualizada correctamente')
    window.location.href = '/dashboard'
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Seguridad
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
          Cambiar contraseña
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Ingresa una nueva contraseña para recuperar el acceso a tu cuenta.
        </p>

        {!ready ? (
          <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Abre esta pantalla desde el enlace de recuperación enviado a tu
            correo.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nueva contraseña
              </span>
              <div className="relative">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 pr-12 text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Confirmar contraseña
              </span>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                required
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="min-h-12 w-full rounded-2xl bg-[#15936A] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#0E6B4E] disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
