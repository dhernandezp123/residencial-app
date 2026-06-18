'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type CurrentProfile = {
  id: string
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
  residential_id: string | null
}

type GuardProfile = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  status: string | null
  residential_id: string | null
  residential: ResidentialSummary | null
}

type GuardProfileRow = Omit<GuardProfile, 'residential'>

type ResidentialSummary = {
  id: string
  name: string
}

type GuardFormData = {
  residential_id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  password: string
}

const initialFormData: GuardFormData = {
  residential_id: '',
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  password: '',
}

export default function GuardsPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [guards, setGuards] = useState<GuardProfile[]>([])
  const [residentials, setResidentials] = useState<ResidentialSummary[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<GuardFormData>(initialFormData)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesión para administrar guardias')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,role,status,residential_id')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError || !profileData) {
      console.error('Error loading profile:', profileError)
      toast.error('No se pudo cargar tu perfil')
      setLoading(false)
      return
    }

    const currentProfile = profileData as CurrentProfile
    setProfile(currentProfile)

    if (
      currentProfile.status !== 'approved' ||
      !['super_admin', 'admin'].includes(currentProfile.role)
    ) {
      setLoading(false)
      return
    }

    const guardsQuery = supabase
      .from('profiles')
      .select('id,first_name,last_name,phone,status,residential_id')
      .eq('role', 'guard')
      .order('created_at', { ascending: false })

    if (currentProfile.role === 'admin') {
      if (!currentProfile.residential_id) {
        setGuards([])
        setLoading(false)
        return
      }

      guardsQuery.eq('residential_id', currentProfile.residential_id)
    }

    const { data: guardsData, error: guardsError } = await guardsQuery

    if (guardsError) {
      console.error('Error loading guards:', guardsError)
      toast.error('No se pudieron cargar los guardias')
      setGuards([])
      setLoading(false)
      return
    }

    const guardRows = (guardsData || []) as GuardProfileRow[]
    const residentialIds = Array.from(
      new Set(
        guardRows
          .map((guard) => guard.residential_id)
          .filter((residentialId): residentialId is string =>
            Boolean(residentialId)
          )
      )
    )

    const { data: residentialsData, error: residentialsError } =
      residentialIds.length > 0
        ? await supabase
            .from('residentials')
            .select('id,name')
            .in('id', residentialIds)
        : { data: [], error: null }

    if (residentialsError) {
      console.error('Error loading guard residentials:', residentialsError)
      toast.error('No se pudieron cargar los residenciales')
      setLoading(false)
      return
    }

    const residentialById = new Map(
      ((residentialsData || []) as ResidentialSummary[]).map((residential) => [
        residential.id,
        residential,
      ])
    )

    const enrichedGuards = guardRows.map((guard) => ({
      ...guard,
      residential: guard.residential_id
        ? residentialById.get(guard.residential_id) || null
        : null,
    }))

    setGuards(enrichedGuards)

    if (currentProfile.role === 'super_admin') {
      const { data: allResidentialsData, error: allResidentialsError } =
        await supabase
          .from('residentials')
          .select('id,name')
          .eq('is_active', true)
          .order('name', { ascending: true })

      if (allResidentialsError) {
        console.error('Error loading residentials:', allResidentialsError)
        toast.error('No se pudieron cargar los residenciales')
      } else {
        setResidentials(allResidentialsData || [])
      }
    }

    if (currentProfile.role === 'admin' && currentProfile.residential_id) {
      const { data: adminResidentialData } = await supabase
        .from('residentials')
        .select('id,name')
        .eq('id', currentProfile.residential_id)
        .single()

      if (adminResidentialData) {
        setResidentials([adminResidentialData])
        setFormData((currentFormData) => ({
          ...currentFormData,
          residential_id: adminResidentialData.id,
        }))
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  const handleCreateGuard = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    toast.info('Pendiente implementar Edge Function create-guard')
    setSaving(false)
  }

  const canManageGuards =
    profile?.status === 'approved' &&
    (profile.role === 'super_admin' || profile.role === 'admin')

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
            <div className="h-5 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-4 w-48 rounded-full bg-slate-200 dark:bg-slate-700" />
          </section>
          <section className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
                <div className="h-5 w-36 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-4 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </section>
        </div>
      </main>
    )
  }

  if (!canManageGuards) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Guardias</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            Acceso no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Solo super administradores y administradores aprobados pueden
            administrar guardias.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 block min-h-12 rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 text-center font-semibold text-white active:scale-[0.99]"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <Link
          href="/dashboard"
          className="block text-sm font-semibold text-slate-600 dark:text-slate-300"
        >
          ← Volver al dashboard
        </Link>

        <header className="rounded-2xl bg-slate-950 dark:bg-slate-800 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Administración</p>
          <h1 className="mt-1 text-2xl font-bold">Guardias</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Administra usuarios de seguridad para validar accesos en garita.
          </p>
        </header>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="min-h-12 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          {showForm ? 'Cancelar' : '+ Agregar guardia'}
        </button>

        {showForm && (
          <form
            onSubmit={handleCreateGuard}
            className="space-y-4 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm"
          >
            {profile?.role === 'super_admin' && (
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Residencial
                </span>
                <select
                  value={formData.residential_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      residential_id: e.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
                  required
                >
                  <option value="">Selecciona residencial</option>
                  {residentials.map((residential) => (
                    <option key={residential.id} value={residential.id}>
                      {residential.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nombre
              </span>
              <input
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                placeholder="Ej: Mario"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Apellido
              </span>
              <input
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                placeholder="Ej: Rivera"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Teléfono
              </span>
              <input
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="Ej: 9999-9999"
                type="tel"
                inputMode="tel"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Correo
              </span>
              <input
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="guardia@correo.com"
                type="email"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Contraseña temporal
              </span>
              <div className="relative">
                <input
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Mínimo 6 caracteres"
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 pr-12 text-sm outline-none"
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

            <button
              type="submit"
              disabled={saving}
              className="min-h-12 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
            >
              {saving ? 'Guardando...' : 'Guardar guardia'}
            </button>
          </form>
        )}

        {guards.length === 0 ? (
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 text-sm leading-6 text-slate-500 dark:text-slate-400 shadow-sm">
            No hay guardias registrados.
          </section>
        ) : (
          <section className="space-y-3">
            {guards.map((guard) => (
              <article key={guard.id} className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {guard.first_name} {guard.last_name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {guard.phone || 'Sin teléfono'}
                    </p>
                  </div>
                  <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-300">
                    {guard.status || 'approved'}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Residencial:
                  </span>{' '}
                  {guard.residential?.name || 'Sin residencial'}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
