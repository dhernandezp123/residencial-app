'use client'

export const dynamic = 'force-dynamic'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Residential = {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  max_houses: number | null
  is_active: boolean | null
}

type House = {
  id: string
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: number | null
  is_active: boolean | null
  notes: string | null
}

type AdminProfile = {
  id: string
  user_id: string
  first_name: string
  last_name: string
  phone: string | null
  status: string | null
}

type ResidentCandidate = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  status: string | null
  house_id: string | null
  house: HouseSummary | null
}

type ResidentCandidateRow = Omit<ResidentCandidate, 'house'>

type HouseSummary = {
  id: string
  block: string
  house_number: string
}

export default function ResidentialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [residential, setResidential] = useState<Residential | null>(null)
  const [houses, setHouses] = useState<House[]>([])
  const [admins, setAdmins] = useState<AdminProfile[]>([])
  const [residentCandidates, setResidentCandidates] = useState<ResidentCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingAdmin, setSavingAdmin] = useState(false)
  const [promotingResidentId, setPromotingResidentId] = useState<string | null>(null)
  const [editingMaxHouses, setEditingMaxHouses] = useState(false)
  const [savingMaxHouses, setSavingMaxHouses] = useState(false)
  const [resettingAdminId, setResettingAdminId] = useState<string | null>(null)
  const [houseSearch, setHouseSearch] = useState('')

  const [formData, setFormData] = useState({
    block: '',
    house_number: '',
    pays_security: true,
    resident_limit: '3',
    notes: '',
  })

  const [adminFormData, setAdminFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    password: '',
  })

  const [maxHousesFormData, setMaxHousesFormData] = useState({
    max_houses: '',
  })

  const loadData = async () => {
    setLoading(true)

    const { data: residentialData, error: residentialError } = await supabase
      .from('residentials')
      .select('id,name,address,city,country,max_houses,is_active')
      .eq('id', id)
      .single()

    if (residentialError) {
      console.error('Error loading residential:', residentialError)
      toast.error('No se pudo cargar el residencial')
      setLoading(false)
      return
    }

    const { data: housesData, error: housesError } = await supabase
      .from('houses')
      .select('id,block,house_number,pays_security,resident_limit,is_active,notes')
      .eq('residential_id', id)
      .order('block', { ascending: true })
      .order('house_number', { ascending: true })

    if (housesError) {
      console.error('Error loading houses:', housesError)
      toast.error('No se pudieron cargar las casas')
    }

    const { data: adminsData, error: adminsError } = await supabase
      .from('profiles')
      .select('id,user_id,first_name,last_name,phone,status')
      .eq('residential_id', id)
      .or('role.eq.admin,is_residential_admin.eq.true')
      .order('created_at', { ascending: false })

    if (adminsError) {
      console.error('Error loading residential admins:', adminsError)
      toast.error(adminsError.message)
    }

    const { data: candidatesData, error: candidatesError } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,phone,status,house_id')
      .eq('residential_id', id)
      .eq('role', 'resident')
      .eq('is_residential_admin', false)
      .in('status', ['approved', 'pending'])
      .order('last_name', { ascending: true })

    if (candidatesError) {
      console.error('Error loading resident admin candidates:', candidatesError)
      toast.error('No se pudieron cargar residentes')
    }

    const candidateRows = (candidatesData || []) as ResidentCandidateRow[]
    const candidateHouseIds = Array.from(
      new Set(
        candidateRows
          .map((candidate) => candidate.house_id)
          .filter((houseId): houseId is string => Boolean(houseId)),
      ),
    )

    const { data: candidateHousesData, error: candidateHousesError } =
      candidateHouseIds.length > 0
        ? await supabase
            .from('houses')
            .select('id,block,house_number')
            .in('id', candidateHouseIds)
        : { data: [], error: null }

    if (candidateHousesError) {
      console.error('Error loading candidate houses:', candidateHousesError)
    }

    const candidateHousesById = new Map(
      ((candidateHousesData || []) as HouseSummary[]).map((house) => [
        house.id,
        house,
      ]),
    )

    setResidential(residentialData)
    setMaxHousesFormData({
      max_houses: residentialData.max_houses
        ? String(residentialData.max_houses)
        : '',
    })
    setHouses(housesData || [])
    setAdmins(adminsData || [])
    setResidentCandidates(
      candidateRows.map((candidate) => ({
        ...candidate,
        house: candidate.house_id
          ? candidateHousesById.get(candidate.house_id) || null
          : null,
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleCreateHouse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      residential?.max_houses &&
      residential.max_houses > 0 &&
      houses.length >= residential.max_houses
    ) {
      toast.error('Aumenta casas contratadas antes de registrar otra casa')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('houses').insert({
      residential_id: id,
      block: formData.block.trim().toUpperCase(),
      house_number: formData.house_number.trim(),
      pays_security: formData.pays_security,
      resident_limit: Number(formData.resident_limit || 3),
      notes: formData.notes.trim() || null,
      is_active: true,
    })

    setSaving(false)

    if (error) {
      console.error('Error creating house:', error)
      toast.error(error.message)
      return
    }

    toast.success('Casa creada correctamente')

    setFormData({
      block: '',
      house_number: '',
      pays_security: true,
      resident_limit: '3',
      notes: '',
    })

    setShowForm(false)
    loadData()
  }

  const handleUpdateMaxHouses = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!residential) return

    const nextMaxHouses = Number(maxHousesFormData.max_houses || 0)

    if (nextMaxHouses < houses.length) {
      toast.error(
        `No puede ser menor que las ${houses.length} casas ya registradas`,
      )
      return
    }

    setSavingMaxHouses(true)

    const { error } = await supabase
      .from('residentials')
      .update({ max_houses: nextMaxHouses })
      .eq('id', residential.id)

    setSavingMaxHouses(false)

    if (error) {
      console.error('Error updating max houses:', error)
      toast.error('No se pudo actualizar casas contratadas')
      return
    }

    setResidential({ ...residential, max_houses: nextMaxHouses })
    setEditingMaxHouses(false)
    toast.success('Casas contratadas actualizadas')
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAdmin(true)
    toast.info('Selecciona un residente registrado para habilitarlo')
    setSavingAdmin(false)
  }

  const handlePromoteResident = async (resident: ResidentCandidate) => {
    setPromotingResidentId(resident.id)

    const { error } = await supabase
      .from('profiles')
      .update({
        is_residential_admin: true,
        status: 'approved',
        residential_id: id,
      })
      .eq('id', resident.id)
      .eq('role', 'resident')

    setPromotingResidentId(null)

    if (error) {
      console.error('Error promoting resident to admin:', error)
      toast.error('No se pudo habilitar como administrador')
      return
    }

    toast.success('Residente habilitado como administrador')
    await loadData()
  }

  const handleSendPasswordReset = async (admin: AdminProfile) => {
    setResettingAdminId(admin.id)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      toast.error('Inicia sesión nuevamente')
      setResettingAdminId(null)
      return
    }

    const response = await fetch('/api/admin/send-password-reset', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ profileId: admin.id }),
    })

    setResettingAdminId(null)

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      toast.error(payload.error || 'No se pudo enviar el reset')
      return
    }

    toast.success('Correo de recuperación enviado')
  }

  const handleCopyRegisterLink = async () => {
    if (!residential) {
      return
    }

    const registerUrl = `${window.location.origin}/register?residential_id=${residential.id}`

    try {
      await navigator.clipboard.writeText(registerUrl)
      toast.success('Link de registro copiado')
    } catch (error) {
      console.error('Error copying register link:', error)
      toast.error('No se pudo copiar el link')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
          Cargando residencial...
        </div>
      </main>
    )
  }

  if (!residential) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-900">Residencial no encontrado</p>
          <Link href="/dashboard/residentials" className="mt-4 block text-sm font-semibold text-slate-700">
            Volver
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <nav className="grid grid-cols-2 gap-2">
          <Link
            href="/dashboard"
            className="min-h-11 rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm active:scale-[0.99]"
          >
            Menú principal
          </Link>
          <Link
            href="/dashboard/residentials"
            className="min-h-11 rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm active:scale-[0.99]"
          >
            Residenciales
          </Link>
        </nav>
        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Residencial</p>
          <h1 className="mt-1 text-2xl font-bold">{residential.name}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {residential.city || 'Sin ciudad'} · {residential.country || 'Sin país'}
          </p>
          <p className="mt-4 text-sm text-slate-300">
            Casas contratadas: <span className="font-semibold text-white">{residential.max_houses || 0}</span>
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Casas registradas: <span className="font-semibold text-white">{houses.length}</span>
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Disponibles para registrar:{' '}
            <span className="font-semibold text-white">
              {Math.max((residential.max_houses || 0) - houses.length, 0)}
            </span>
          </p>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">Contrato</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Casas contratadas
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ajusta el cupo contratado cuando el residencial agregue casas,
                etapas o apartamentos.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {residential.max_houses || 0}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setEditingMaxHouses(!editingMaxHouses)}
            className="mt-4 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-800 active:scale-[0.99]"
          >
            {editingMaxHouses ? 'Cancelar' : 'Editar casas contratadas'}
          </button>

          {editingMaxHouses && (
            <form onSubmit={handleUpdateMaxHouses} className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Nuevo total contratado
                </span>
                <input
                  value={maxHousesFormData.max_houses}
                  onChange={(e) =>
                    setMaxHousesFormData({ max_houses: e.target.value })
                  }
                  min={houses.length}
                  type="number"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={savingMaxHouses}
                className="min-h-12 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
              >
                {savingMaxHouses ? 'Guardando...' : 'Guardar cupo'}
              </button>
            </form>
          )}
        </section>

        <button
          type="button"
          onClick={handleCopyRegisterLink}
          className="min-h-12 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900 shadow-sm active:scale-[0.99]"
        >
          Copiar link de invitación
        </button>

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Operación
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Administradores del residencial
            </h2>
          </div>

          {admins.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              No hay administradores asignados.
            </div>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => (
                <article
                  key={admin.id}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {admin.first_name} {admin.last_name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {admin.phone || 'Sin teléfono'}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      {admin.status || 'approved'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSendPasswordReset(admin)}
                    disabled={resettingAdminId === admin.id}
                    className="mt-4 min-h-10 w-full rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-60 active:scale-[0.99]"
                  >
                    {resettingAdminId === admin.id
                      ? 'Enviando...'
                      : 'Enviar reset de contraseña'}
                  </button>
                </article>
              ))}
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">
              Habilitar residente como administrador
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Selecciona un residente ya registrado. No se crea otra cuenta ni
              se solicita contraseña nueva.
            </p>
          </div>

          {residentCandidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">
              No hay residentes disponibles para habilitar.
            </div>
          ) : (
            <div className="space-y-3">
              {residentCandidates.map((resident) => {
                const houseLabel = resident.house
                  ? `${resident.house.block}-${resident.house.house_number}`
                  : 'Sin casa'

                return (
                  <article
                    key={resident.id}
                    className="rounded-2xl border border-slate-100 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {resident.first_name} {resident.last_name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {resident.phone || 'Sin telefono'} · Casa {houseLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {resident.status || 'pending'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handlePromoteResident(resident)}
                      disabled={promotingResidentId === resident.id}
                      className="mt-4 min-h-10 w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
                    >
                      {promotingResidentId === resident.id
                        ? 'Habilitando...'
                        : 'Habilitar como administrador'}
                    </button>
                  </article>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAdminForm(!showAdminForm)}
            className="hidden"
          >
            {showAdminForm ? 'Cancelar' : '+ Agregar administrador'}
          </button>

          {showAdminForm && (
            <form onSubmit={handleCreateAdmin} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Nombre
                </span>
                <input
                  value={adminFormData.first_name}
                  onChange={(e) =>
                    setAdminFormData({
                      ...adminFormData,
                      first_name: e.target.value,
                    })
                  }
                  placeholder="Ej: Carlos"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Apellido
                </span>
                <input
                  value={adminFormData.last_name}
                  onChange={(e) =>
                    setAdminFormData({
                      ...adminFormData,
                      last_name: e.target.value,
                    })
                  }
                  placeholder="Ej: Mejía"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Teléfono
                </span>
                <input
                  value={adminFormData.phone}
                  onChange={(e) =>
                    setAdminFormData({
                      ...adminFormData,
                      phone: e.target.value,
                    })
                  }
                  placeholder="Ej: 9999-9999"
                  type="tel"
                  inputMode="tel"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Correo
                </span>
                <input
                  value={adminFormData.email}
                  onChange={(e) =>
                    setAdminFormData({
                      ...adminFormData,
                      email: e.target.value,
                    })
                  }
                  placeholder="admin@correo.com"
                  type="email"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Contraseña temporal
                </span>
                <div className="relative">
                  <input
                    value={adminFormData.password}
                    onChange={(e) =>
                      setAdminFormData({
                        ...adminFormData,
                        password: e.target.value,
                      })
                    }
                    placeholder="Mínimo 6 caracteres"
                    type={showAdminPassword ? 'text' : 'password'}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      setShowAdminPassword(!showAdminPassword)
                    }}
                    aria-label={
                      showAdminPassword
                        ? 'Ocultar contraseña'
                        : 'Mostrar contraseña'
                    }
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    {showAdminPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={savingAdmin}
                className="min-h-12 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
              >
                {savingAdmin ? 'Guardando...' : 'Guardar administrador'}
              </button>
            </form>
          )}
        </section>

        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full rounded-2xl bg-slate-950 py-4 font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          {showForm ? 'Cancelar' : '+ Nueva casa'}
        </button>

        {showForm && (
          <form
            onSubmit={handleCreateHouse}
            className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
          >
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Lote / bloque
              </span>
              <input
                value={formData.block}
                onChange={(e) =>
                  setFormData({ ...formData, block: e.target.value })
                }
                placeholder="Ej: C o D"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Número de casa
              </span>
              <input
                value={formData.house_number}
                onChange={(e) =>
                  setFormData({ ...formData, house_number: e.target.value })
                }
                placeholder="Ej: 24"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Máximo usuarios app por casa
              </span>
              <input
                value={formData.resident_limit}
                onChange={(e) =>
                  setFormData({ ...formData, resident_limit: e.target.value })
                }
                placeholder="Ej: 3"
                type="number"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
              />
              <p className="text-xs leading-5 text-slate-500">
                Cantidad máxima de residentes aprobados que podrán anunciar
                visitas desde esta casa. No limita la cantidad de visitas.
              </p>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Notas
              </span>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Notas opcionales"
                className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Paga seguridad
              <input
                type="checkbox"
                checked={formData.pays_security}
                onChange={(e) =>
                  setFormData({ ...formData, pays_security: e.target.checked })
                }
                className="h-5 w-5"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-slate-950 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar casa'}
            </button>
          </form>
        )}

        {houses.length === 0 ? (
          <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
            No hay casas registradas.
          </div>
        ) : (() => {
          const query = houseSearch.trim().toLowerCase()
          const filtered = query
            ? houses.filter((h) =>
                `${h.block}-${h.house_number}`.toLowerCase().includes(query)
              )
            : houses

          const grouped = filtered.reduce<Record<string, House[]>>((acc, house) => {
            if (!acc[house.block]) acc[house.block] = []
            acc[house.block].push(house)
            return acc
          }, {})

          const blocks = Object.keys(grouped).sort()

          return (
            <section className="space-y-3">
              <div className="relative">
                <input
                  type="search"
                  value={houseSearch}
                  onChange={(e) => setHouseSearch(e.target.value)}
                  placeholder="Buscar casa (ej: D-83)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none shadow-sm placeholder:text-slate-400"
                />
              </div>

              {blocks.length === 0 ? (
                <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
                  Sin resultados para &ldquo;{houseSearch}&rdquo;.
                </div>
              ) : (
                blocks.map((block) => (
                  <div key={block} className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">Bloque {block}</h3>
                      <span className="text-xs text-slate-400">
                        {grouped[block].length} casa{grouped[block].length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {grouped[block].map((house) => (
                        <Link
                          key={house.id}
                          href={`/dashboard/houses/${house.id}`}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 active:scale-[0.97]"
                        >
                          <span
                            className={`h-2 w-2 flex-shrink-0 rounded-full ${
                              house.pays_security ? 'bg-green-500' : 'bg-amber-400'
                            }`}
                          />
                          {house.house_number}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          )
        })()}
      </div>
    </main>
  )
}
