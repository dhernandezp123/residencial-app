'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Eye, EyeOff, ShieldPlus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/ui'

type Role = 'super_admin' | 'admin' | 'resident' | 'guard'
type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'inactive'

type CurrentProfile = {
  id: string
  role: Role
  status: ProfileStatus
  residential_id: string | null
  is_residential_admin: boolean | null
}

type ResidentialSummary = {
  id: string
  name: string
}

type GuardProfile = {
  id: string
  user_id: string
  first_name: string
  last_name: string
  phone: string | null
  status: ProfileStatus | null
  residential_id: string | null
  access_email: string | null
  uses_internal_email: boolean | null
  residential: ResidentialSummary | null
}

type GuardProfileRow = Omit<GuardProfile, 'residential'>

type GuardFormData = {
  residential_id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  no_email: boolean
  password: string
}

type EditGuardFormData = {
  residential_id: string
  first_name: string
  last_name: string
  phone: string
  status: 'approved' | 'inactive'
}

const initialFormData: GuardFormData = {
  residential_id: '',
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  no_email: false,
  password: '',
}

const initialEditFormData: EditGuardFormData = {
  residential_id: '',
  first_name: '',
  last_name: '',
  phone: '',
  status: 'approved',
}

function getStatusLabel(status: ProfileStatus | null): string {
  if (status === 'approved') return 'Activo'
  if (status === 'inactive') return 'Inactivo'
  if (status === 'pending') return 'Pendiente'
  if (status === 'rejected') return 'Rechazado'
  return 'Activo'
}

function canSendEmailReset(guard: GuardProfile): boolean {
  return Boolean(
    guard.access_email &&
      !guard.uses_internal_email &&
      !guard.access_email.endsWith('@residentpass.local'),
  )
}

export default function GuardsPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [guards, setGuards] = useState<GuardProfile[]>([])
  const [residentials, setResidentials] = useState<ResidentialSummary[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<GuardFormData>(initialFormData)
  const [editFormData, setEditFormData] =
    useState<EditGuardFormData>(initialEditFormData)
  const [showPassword, setShowPassword] = useState(false)
  const [showTempPassword, setShowTempPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingGuardId, setEditingGuardId] = useState<string | null>(null)
  const [updatingGuardId, setUpdatingGuardId] = useState<string | null>(null)
  const [resettingGuardId, setResettingGuardId] = useState<string | null>(null)
  const [passwordGuardId, setPasswordGuardId] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [settingPasswordGuardId, setSettingPasswordGuardId] =
    useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesion para administrar guardias')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,role,status,residential_id,is_residential_admin')
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
    const isDelegatedAdmin = Boolean(currentProfile.is_residential_admin)
    const isAdminLike = currentProfile.role === 'admin' || isDelegatedAdmin

    if (
      currentProfile.status !== 'approved' ||
      !(currentProfile.role === 'super_admin' || isAdminLike)
    ) {
      setLoading(false)
      return
    }

    const guardsQuery = supabase
      .from('profiles')
      .select(
        'id,user_id,first_name,last_name,phone,status,residential_id,access_email,uses_internal_email',
      )
      .eq('role', 'guard')
      .order('created_at', { ascending: false })

    if (isAdminLike) {
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
            Boolean(residentialId),
          ),
      ),
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
      ]),
    )

    setGuards(
      guardRows.map((guard) => ({
        ...guard,
        residential: guard.residential_id
          ? residentialById.get(guard.residential_id) || null
          : null,
      })),
    )

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

    if (isAdminLike && currentProfile.residential_id) {
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

  const getSessionToken = async (): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData.session?.access_token || null
  }

  const handleCreateGuard = async (event: React.FormEvent) => {
    event.preventDefault()

    const token = await getSessionToken()
    if (!token) {
      toast.error('Inicia sesion nuevamente')
      return
    }

    if (!formData.no_email && !formData.email.trim()) {
      toast.error('Ingresa un correo o marca que el guardia no tiene correo')
      return
    }

    setSaving(true)

    const response = await fetch('/api/admin/create-guard', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        residentialId: formData.residential_id,
        firstName: formData.first_name,
        lastName: formData.last_name,
        phone: formData.phone,
        email: formData.no_email ? '' : formData.email,
        password: formData.password,
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      accessEmail?: string
      usesInternalEmail?: boolean
    }

    setSaving(false)

    if (!response.ok) {
      toast.error(payload.error || 'No se pudo crear el guardia')
      return
    }

    toast.success(
      payload.usesInternalEmail
        ? `Guardia creado. Usuario: ${payload.accessEmail}`
        : 'Guardia creado correctamente',
    )

    setFormData({
      ...initialFormData,
      residential_id:
        profile?.role === 'admin' || profile?.is_residential_admin
          ? formData.residential_id
          : '',
    })
    setShowForm(false)
    await loadData()
  }

  const startEditingGuard = (guard: GuardProfile) => {
    setEditingGuardId(guard.id)
    setPasswordGuardId(null)
    setEditFormData({
      residential_id: guard.residential_id || '',
      first_name: guard.first_name,
      last_name: guard.last_name,
      phone: guard.phone || '',
      status: guard.status === 'inactive' ? 'inactive' : 'approved',
    })
  }

  const handleUpdateGuard = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingGuardId) return

    const token = await getSessionToken()
    if (!token) {
      toast.error('Inicia sesion nuevamente')
      return
    }

    setUpdatingGuardId(editingGuardId)

    const response = await fetch('/api/admin/update-guard', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        profileId: editingGuardId,
        residentialId: editFormData.residential_id,
        firstName: editFormData.first_name,
        lastName: editFormData.last_name,
        phone: editFormData.phone,
        status: editFormData.status,
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
    }

    setUpdatingGuardId(null)

    if (!response.ok) {
      toast.error(payload.error || 'No se pudo actualizar el guardia')
      return
    }

    toast.success('Guardia actualizado')
    setEditingGuardId(null)
    await loadData()
  }

  const handleSendPasswordReset = async (guard: GuardProfile) => {
    setResettingGuardId(guard.id)

    const token = await getSessionToken()
    if (!token) {
      toast.error('Inicia sesion nuevamente')
      setResettingGuardId(null)
      return
    }

    const response = await fetch('/api/admin/send-password-reset', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ profileId: guard.id }),
    })

    setResettingGuardId(null)

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      toast.error(payload.error || 'No se pudo enviar el reset')
      return
    }

    toast.success('Correo de recuperacion enviado')
  }

  const handleSetTemporaryPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!passwordGuardId) return

    const token = await getSessionToken()
    if (!token) {
      toast.error('Inicia sesion nuevamente')
      return
    }

    setSettingPasswordGuardId(passwordGuardId)

    const response = await fetch('/api/admin/set-temporary-password', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        profileId: passwordGuardId,
        password: temporaryPassword,
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
    }

    setSettingPasswordGuardId(null)

    if (!response.ok) {
      toast.error(payload.error || 'No se pudo asignar la contrasena')
      return
    }

    toast.success('Contrasena temporal asignada')
    setPasswordGuardId(null)
    setTemporaryPassword('')
    setShowTempPassword(false)
  }

  const canManageGuards =
    profile?.status === 'approved' &&
    (profile.role === 'super_admin' ||
      profile.role === 'admin' ||
      profile.is_residential_admin)

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
          <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
            <div className="h-5 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-4 w-48 rounded-full bg-slate-200 dark:bg-slate-700" />
          </section>
          <section className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800"
              >
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
      <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Guardias
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            Acceso no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Solo super administradores y administradores aprobados pueden
            administrar guardias.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 block min-h-12 rounded-2xl bg-slate-950 px-4 py-3 text-center font-semibold text-white active:scale-[0.99] dark:bg-slate-700"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
      <div className="mx-auto max-w-sm space-y-5">
        <Link
          href="/dashboard"
          className="block text-sm font-semibold text-slate-600 dark:text-slate-300"
        >
          Volver al dashboard
        </Link>

        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg dark:bg-slate-800">
          <p className="text-sm text-slate-300">Administracion</p>
          <h1 className="mt-1 text-2xl font-bold">Guardias</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Administra usuarios de seguridad para validar accesos en garita.
          </p>
        </header>

        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm)
            setEditingGuardId(null)
            setPasswordGuardId(null)
          }}
          className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white shadow-sm active:scale-[0.99] dark:bg-slate-700"
        >
          {showForm ? 'Cancelar' : '+ Agregar guardia'}
        </button>

        {showForm && (
          <form
            onSubmit={handleCreateGuard}
            className="space-y-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800"
          >
            {profile?.role === 'super_admin' && (
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Residencial
                </span>
                <select
                  value={formData.residential_id}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      residential_id: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
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
                onChange={(event) =>
                  setFormData({ ...formData, first_name: event.target.value })
                }
                placeholder="Ej: Mario"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Apellido
              </span>
              <input
                value={formData.last_name}
                onChange={(event) =>
                  setFormData({ ...formData, last_name: event.target.value })
                }
                placeholder="Ej: Rivera"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Telefono
              </span>
              <input
                value={formData.phone}
                onChange={(event) =>
                  setFormData({ ...formData, phone: event.target.value })
                }
                placeholder="Ej: 9999-9999"
                type="tel"
                inputMode="tel"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                required
              />
            </label>

            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-700/60">
              <input
                type="checkbox"
                checked={formData.no_email}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    no_email: event.target.checked,
                    email: event.target.checked ? '' : formData.email,
                  })
                }
                className="mt-1 h-5 w-5 rounded accent-slate-950"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  El guardia no tiene correo
                </span>
                <span className="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">
                  Se generara un usuario interno para iniciar sesion.
                </span>
              </span>
            </label>

            {!formData.no_email && (
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Correo
                </span>
                <input
                  value={formData.email}
                  onChange={(event) =>
                    setFormData({ ...formData, email: event.target.value })
                  }
                  placeholder="guardia@correo.com"
                  type="email"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  required={!formData.no_email}
                />
              </label>
            )}

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Contrasena temporal
              </span>
              <div className="relative">
                <input
                  value={formData.password}
                  onChange={(event) =>
                    setFormData({ ...formData, password: event.target.value })
                  }
                  placeholder="Minimo 6 caracteres"
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    setShowPassword(!showPassword)
                  }}
                  aria-label={
                    showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'
                  }
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
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
              className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99] dark:bg-slate-700"
            >
              {saving ? 'Guardando...' : 'Guardar guardia'}
            </button>
          </form>
        )}

        {guards.length === 0 ? (
          <EmptyState
            icon={<ShieldPlus className="h-6 w-6" />}
            title="No hay guardias registrados"
            description="Agrega un guardia para que pueda validar accesos en garita."
            action={
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="block min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white active:scale-[0.99] dark:bg-slate-700"
              >
                Agregar guardia
              </button>
            }
          />
        ) : (
          <section className="space-y-3">
            {guards.map((guard) => {
              const isEditing = editingGuardId === guard.id
              const isPasswordOpen = passwordGuardId === guard.id
              const sendReset = canSendEmailReset(guard)

              return (
                <article
                  key={guard.id}
                  className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">
                        {guard.first_name} {guard.last_name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {guard.phone || 'Sin telefono'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        guard.status === 'inactive'
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      }`}
                    >
                      {getStatusLabel(guard.status)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <p>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Residencial:
                      </span>{' '}
                      {guard.residential?.name || 'Sin residencial'}
                    </p>
                    <p className="break-all">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Usuario:
                      </span>{' '}
                      {guard.access_email || 'No registrado'}
                    </p>
                    {guard.uses_internal_email && (
                      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Este guardia usa usuario interno. Para recuperar acceso,
                        asigna una contrasena temporal.
                      </p>
                    )}
                  </div>

                  {isEditing && (
                    <form
                      onSubmit={handleUpdateGuard}
                      className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-700/60"
                    >
                      {profile?.role === 'super_admin' && (
                        <label className="block space-y-1">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Residencial
                          </span>
                          <select
                            value={editFormData.residential_id}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                residential_id: event.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            required
                          >
                            <option value="">Selecciona residencial</option>
                            {residentials.map((residential) => (
                              <option
                                key={residential.id}
                                value={residential.id}
                              >
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
                          value={editFormData.first_name}
                          onChange={(event) =>
                            setEditFormData({
                              ...editFormData,
                              first_name: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          required
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Apellido
                        </span>
                        <input
                          value={editFormData.last_name}
                          onChange={(event) =>
                            setEditFormData({
                              ...editFormData,
                              last_name: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          required
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Telefono
                        </span>
                        <input
                          value={editFormData.phone}
                          onChange={(event) =>
                            setEditFormData({
                              ...editFormData,
                              phone: event.target.value,
                            })
                          }
                          type="tel"
                          inputMode="tel"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          required
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Estado
                        </span>
                        <select
                          value={editFormData.status}
                          onChange={(event) =>
                            setEditFormData({
                              ...editFormData,
                              status: event.target.value as
                                | 'approved'
                                | 'inactive',
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="approved">Activo</option>
                          <option value="inactive">Inactivo</option>
                        </select>
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingGuardId(null)}
                          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 active:scale-[0.99] dark:border-slate-600 dark:text-slate-200"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={updatingGuardId === guard.id}
                          className="min-h-11 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 active:scale-[0.99] dark:bg-slate-600"
                        >
                          {updatingGuardId === guard.id
                            ? 'Guardando...'
                            : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  )}

                  {isPasswordOpen && (
                    <form
                      onSubmit={handleSetTemporaryPassword}
                      className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-700/60"
                    >
                      <label className="block space-y-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Nueva contrasena temporal
                        </span>
                        <div className="relative">
                          <input
                            value={temporaryPassword}
                            onChange={(event) =>
                              setTemporaryPassword(event.target.value)
                            }
                            type={showTempPassword ? 'text' : 'password'}
                            minLength={6}
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            required
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowTempPassword(!showTempPassword)
                            }
                            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                            aria-label={
                              showTempPassword
                                ? 'Ocultar contrasena'
                                : 'Mostrar contrasena'
                            }
                          >
                            {showTempPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordGuardId(null)
                            setTemporaryPassword('')
                          }}
                          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 active:scale-[0.99] dark:border-slate-600 dark:text-slate-200"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={settingPasswordGuardId === guard.id}
                          className="min-h-11 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 active:scale-[0.99] dark:bg-slate-600"
                        >
                          {settingPasswordGuardId === guard.id
                            ? 'Guardando...'
                            : 'Asignar'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false)
                        setPasswordGuardId(null)
                        if (isEditing) {
                          setEditingGuardId(null)
                          return
                        }
                        startEditingGuard(guard)
                      }}
                      className="min-h-10 w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white active:scale-[0.99] dark:bg-slate-700"
                    >
                      {isEditing ? 'Cerrar edicion' : 'Editar guardia'}
                    </button>

                    {sendReset && (
                      <button
                        type="button"
                        onClick={() => void handleSendPasswordReset(guard)}
                        disabled={resettingGuardId === guard.id}
                        className="min-h-10 w-full rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-60 active:scale-[0.99] dark:border-blue-800 dark:text-blue-300"
                      >
                        {resettingGuardId === guard.id
                          ? 'Enviando...'
                          : 'Enviar reset de contrasena'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false)
                        setEditingGuardId(null)
                        setPasswordGuardId(isPasswordOpen ? null : guard.id)
                        setTemporaryPassword('')
                      }}
                      className="min-h-10 w-full rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 active:scale-[0.99] dark:border-amber-800 dark:text-amber-300"
                    >
                      {isPasswordOpen
                        ? 'Cerrar contrasena temporal'
                        : 'Asignar contrasena temporal'}
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}
