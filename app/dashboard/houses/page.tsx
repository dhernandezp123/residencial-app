'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Home } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/ui'

type Role = 'super_admin' | 'admin' | 'resident' | 'guard'
type Status = 'pending' | 'approved' | 'rejected' | 'inactive'

type CurrentProfile = {
  role: Role
  status: Status
  residential_id: string | null
  is_residential_admin: boolean | null
}

type ResidentialSummary = {
  id: string
  name: string
}

type House = {
  id: string
  residential_id: string
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: number | null
  is_active: boolean | null
  notes: string | null
  residentialName: string
  approvedResidents: number
  pendingResidents: number
}

type HouseRow = Omit<
  House,
  'residentialName' | 'approvedResidents' | 'pendingResidents'
> & {
  residentials: { id: string; name: string } | { id: string; name: string }[] | null
}

type ResidentCountRow = {
  house_id: string | null
  status: Status
}

type FormData = {
  residential_id: string
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: string
  notes: string
}

const initialForm: FormData = {
  residential_id: '',
  block: '',
  house_number: '',
  pays_security: true,
  resident_limit: '3',
  notes: '',
}

type HouseAction =
  | 'activate-house'
  | 'deactivate-house'
  | 'activate-security'
  | 'deactivate-security'

type HouseGroup = {
  key: string
  label: string
  sortResidentialName: string
  sortBlock: string
  houses: House[]
  activeCount: number
  securityCount: number
  pendingResidents: number
}

function getResidentialName(
  residentials: HouseRow['residentials'],
): string {
  if (!residentials) return 'Sin residencial'
  return Array.isArray(residentials)
    ? residentials[0]?.name || 'Sin residencial'
    : residentials.name
}

export default function AdminHousesPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [residentials, setResidentials] = useState<ResidentialSummary[]>([])
  const [residentialName, setResidentialName] = useState('')
  const [houses, setHouses] = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingHouseId, setUpdatingHouseId] = useState<string | null>(null)
  const [confirmingHouseAction, setConfirmingHouseAction] = useState<{
    houseId: string
    action: HouseAction
  } | null>(null)
  const [formData, setFormData] = useState<FormData>(initialForm)

  const loadData = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('residential_id,role,status,is_residential_admin')
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
      !(isAdminLike || currentProfile.role === 'super_admin')
    ) {
      toast.error('Acceso no autorizado')
      setHouses([])
      setLoading(false)
      return
    }

    if (isAdminLike && !currentProfile.residential_id) {
      toast.error('No tienes un residencial asignado')
      setHouses([])
      setLoading(false)
      return
    }

    const residentialsQuery = supabase
      .from('residentials')
      .select('id,name')
      .order('name', { ascending: true })

    if (isAdminLike && currentProfile.residential_id) {
      residentialsQuery.eq('id', currentProfile.residential_id)
    }

    const { data: residentialsData, error: residentialsError } =
      await residentialsQuery

    if (residentialsError) {
      console.error('Error loading residentials:', residentialsError)
      toast.error('No se pudieron cargar los residenciales')
      setLoading(false)
      return
    }

    const loadedResidentials = (residentialsData || []) as ResidentialSummary[]
    setResidentials(loadedResidentials)

    if (isAdminLike && loadedResidentials[0]) {
      setResidentialName(loadedResidentials[0].name)
      setFormData((currentFormData) => ({
        ...currentFormData,
        residential_id: loadedResidentials[0].id,
      }))
    } else {
      setResidentialName('Vista global')
    }

    const housesQuery = supabase
      .from('houses')
      .select(
        'id,residential_id,block,house_number,pays_security,resident_limit,is_active,notes,residentials(id,name)',
      )
      .order('block', { ascending: true })
      .order('house_number', { ascending: true })

    if (isAdminLike && currentProfile.residential_id) {
      housesQuery.eq('residential_id', currentProfile.residential_id)
    }

    const { data: housesData, error: housesError } = await housesQuery

    if (housesError) {
      console.error('Error loading houses:', housesError)
      toast.error('No se pudieron cargar las casas')
      setHouses([])
      setLoading(false)
      return
    }

    const houseRows = (housesData || []) as HouseRow[]
    const houseIds = houseRows.map((house) => house.id)

    const { data: residentRows, error: residentRowsError } =
      houseIds.length > 0
        ? await supabase
            .from('profiles')
            .select('house_id,status')
            .eq('role', 'resident')
            .in('house_id', houseIds)
        : { data: [], error: null }

    if (residentRowsError) {
      console.error('Error loading resident counts:', residentRowsError)
      toast.error('No se pudieron cargar los conteos de residentes')
    }

    const countsByHouse = new Map<
      string,
      { approvedResidents: number; pendingResidents: number }
    >()

    ;((residentRows || []) as ResidentCountRow[]).forEach((resident) => {
      if (!resident.house_id) return
      const current = countsByHouse.get(resident.house_id) || {
        approvedResidents: 0,
        pendingResidents: 0,
      }

      if (resident.status === 'approved') current.approvedResidents += 1
      if (resident.status === 'pending') current.pendingResidents += 1
      countsByHouse.set(resident.house_id, current)
    })

    setHouses(
      houseRows.map((house) => {
        const counts = countsByHouse.get(house.id) || {
          approvedResidents: 0,
          pendingResidents: 0,
        }

        return {
          ...house,
          residentialName: getResidentialName(house.residentials),
          approvedResidents: counts.approvedResidents,
          pendingResidents: counts.pendingResidents,
        }
      }),
    )

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  useEffect(() => {
    if (!confirmingHouseAction) return

    const timer = window.setTimeout(() => {
      setConfirmingHouseAction(null)
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [confirmingHouseAction])

  const isConfirmingHouseAction = (
    houseId: string,
    action: HouseAction,
  ): boolean =>
    confirmingHouseAction?.houseId === houseId &&
    confirmingHouseAction.action === action

  const handleCreateHouse = async (event: React.FormEvent) => {
    event.preventDefault()

    const targetResidentialId =
      profile?.role === 'super_admin'
        ? formData.residential_id
        : profile?.residential_id

    if (!targetResidentialId) {
      toast.error('Selecciona un residencial')
      return
    }

    if (!formData.block.trim() || !formData.house_number.trim()) {
      toast.error('Bloque y número de casa son requeridos')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('houses').insert({
      residential_id: targetResidentialId,
      block: formData.block.trim().toUpperCase(),
      house_number: formData.house_number.trim(),
      pays_security: formData.pays_security,
      resident_limit: formData.resident_limit
        ? parseInt(formData.resident_limit, 10)
        : null,
      notes: formData.notes.trim() || null,
      is_active: true,
    })

    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }

    toast.success('Casa registrada correctamente')
    setFormData({
      ...initialForm,
      residential_id:
        profile?.role === 'admin' || profile?.is_residential_admin
          ? targetResidentialId
          : '',
    })
    setShowForm(false)
    await loadData()
    setSaving(false)
  }

  const handleToggleActive = async (house: House) => {
    const nextValue = !house.is_active
    const action: HouseAction = nextValue ? 'activate-house' : 'deactivate-house'

    if (!isConfirmingHouseAction(house.id, action)) {
      setConfirmingHouseAction({ houseId: house.id, action })
      toast.warning(
        nextValue
          ? 'Toca de nuevo para activar esta casa'
          : 'Toca de nuevo para desactivar esta casa y quitar seguridad',
      )
      return
    }

    setConfirmingHouseAction(null)
    setUpdatingHouseId(house.id)
    const payload = nextValue
      ? { is_active: true }
      : { is_active: false, pays_security: false }

    const { data, error } = await supabase
      .from('houses')
      .update(payload)
      .eq('id', house.id)
      .select('is_active,pays_security')
      .single()

    setUpdatingHouseId(null)

    if (error || !data) {
      console.error('Error updating house active state:', error)
      toast.error('No se pudo actualizar la casa')
      return
    }

    toast.success(nextValue ? 'Casa activada' : 'Casa desactivada')
    setHouses((prev) =>
      prev.map((h) =>
        h.id === house.id
          ? {
              ...h,
              is_active: data.is_active,
              pays_security: data.pays_security,
            }
          : h,
      ),
    )
  }

  const handleToggleSecurity = async (house: House) => {
    const nextValue = !house.pays_security
    const action: HouseAction = nextValue
      ? 'activate-security'
      : 'deactivate-security'

    if (!isConfirmingHouseAction(house.id, action)) {
      setConfirmingHouseAction({ houseId: house.id, action })
      toast.warning(
        nextValue
          ? 'Toca de nuevo para activar seguridad'
          : 'Toca de nuevo para quitar seguridad',
      )
      return
    }

    setConfirmingHouseAction(null)
    setUpdatingHouseId(house.id)

    const { data, error } = await supabase
      .from('houses')
      .update({ pays_security: nextValue })
      .eq('id', house.id)
      .select('pays_security')
      .single()

    setUpdatingHouseId(null)

    if (error || !data) {
      console.error('Error updating house security:', error)
      toast.error('No se pudo actualizar la seguridad')
      return
    }

    toast.success(nextValue ? 'Seguridad activada' : 'Seguridad desactivada')
    setHouses((prev) =>
      prev.map((h) =>
        h.id === house.id ? { ...h, pays_security: data.pays_security } : h,
      ),
    )
  }

  const canManageHouses =
    profile?.status === 'approved' &&
    (profile.role === 'admin' ||
      profile.role === 'super_admin' ||
      profile.is_residential_admin)

  const groupedHouses = useMemo<HouseGroup[]>(() => {
    const isGlobalView = profile?.role === 'super_admin'
    const groups = new Map<string, HouseGroup>()

    houses.forEach((house) => {
      const normalizedBlock = house.block.trim() || 'Sin bloque'
      const blockLabel =
        normalizedBlock === 'Sin bloque'
          ? normalizedBlock
          : `Bloque ${normalizedBlock}`
      const key = `${isGlobalView ? house.residential_id : 'residential'}:${normalizedBlock.toUpperCase()}`
      const existingGroup = groups.get(key)

      if (existingGroup) {
        existingGroup.houses.push(house)
        existingGroup.activeCount += house.is_active ? 1 : 0
        existingGroup.securityCount += house.pays_security ? 1 : 0
        existingGroup.pendingResidents += house.pendingResidents
        return
      }

      groups.set(key, {
        key,
        label: isGlobalView
          ? `${house.residentialName} - ${blockLabel}`
          : blockLabel,
        sortResidentialName: isGlobalView ? house.residentialName : '',
        sortBlock: normalizedBlock,
        houses: [house],
        activeCount: house.is_active ? 1 : 0,
        securityCount: house.pays_security ? 1 : 0,
        pendingResidents: house.pendingResidents,
      })
    })

    return Array.from(groups.values()).sort((firstGroup, secondGroup) => {
      const residentialOrder = firstGroup.sortResidentialName.localeCompare(
        secondGroup.sortResidentialName,
        'es',
        { numeric: true },
      )

      if (residentialOrder !== 0) return residentialOrder

      return firstGroup.sortBlock.localeCompare(secondGroup.sortBlock, 'es', {
        numeric: true,
      })
    })
  }, [houses, profile?.role])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-14 animate-pulse rounded-2xl bg-slate-300 dark:bg-slate-600" />
          <div className="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-24 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
          <div className="h-24 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
        </div>
      </main>
    )
  }

  if (!canManageHouses) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Casas
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            Acceso no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Solo administradores aprobados pueden administrar casas.
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
        <PageHeader title="Casas" subtitle={residentialName || 'Administración'} />

        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="min-h-14 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-4 text-center text-lg font-bold text-white shadow-sm active:scale-[0.99]"
        >
          {showForm ? 'Cancelar' : '+ Registrar casa'}
        </button>

        {showForm && (
          <form
            onSubmit={handleCreateHouse}
            className="space-y-4 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm"
          >
            <p className="text-sm font-bold text-slate-950 dark:text-white">
              Nueva casa
            </p>

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

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Bloque
                </span>
                <input
                  value={formData.block}
                  onChange={(event) =>
                    setFormData({ ...formData, block: event.target.value })
                  }
                  placeholder="Ej: A"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Número
                </span>
                <input
                  value={formData.house_number}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      house_number: event.target.value,
                    })
                  }
                  placeholder="Ej: 24"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
                  required
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Límite de residentes
              </span>
              <input
                value={formData.resident_limit}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    resident_limit: event.target.value,
                  })
                }
                type="number"
                min="1"
                max="20"
                placeholder="Ej: 3"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-4">
              <input
                type="checkbox"
                checked={formData.pays_security}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    pays_security: event.target.checked,
                  })
                }
                className="h-5 w-5 rounded accent-slate-950"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Paga seguridad
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Solo casas activas con seguridad pagada pueden generar QRs.
                </p>
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Notas
              </span>
              <textarea
                value={formData.notes}
                onChange={(event) =>
                  setFormData({ ...formData, notes: event.target.value })
                }
                placeholder="Observaciones adicionales"
                className="min-h-20 w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="min-h-12 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
            >
              {saving ? 'Guardando...' : 'Guardar casa'}
            </button>
          </form>
        )}

        {houses.length === 0 ? (
          <EmptyState
            icon={<Home className="h-6 w-6" />}
            title="Sin casas registradas"
            description="Registra la primera casa para que los residentes puedan generar visitas."
            action={
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="block min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white active:scale-[0.99] dark:bg-slate-700"
              >
                Registrar casa
              </button>
            }
          />
        ) : (
          <section className="space-y-5">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Casas registradas
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {houses.length} casa{houses.length !== 1 ? 's' : ''} en{' '}
                  {groupedHouses.length} grupo
                  {groupedHouses.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {groupedHouses.map((group) => (
              <section key={group.key} className="space-y-3">
                <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-slate-950 dark:text-white">
                        {group.label}
                      </h2>
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {group.houses.length} casa
                        {group.houses.length !== 1 ? 's' : ''} -{' '}
                        {group.activeCount} activa
                        {group.activeCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <p>{group.securityCount} con seguridad</p>
                      {group.pendingResidents > 0 && (
                        <p className="mt-1 text-amber-700 dark:text-amber-300">
                          {group.pendingResidents} pendiente
                          {group.pendingResidents !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {group.houses.map((house) => (
                    (() => {
                const activeAction: HouseAction = house.is_active
                  ? 'deactivate-house'
                  : 'activate-house'
                const securityAction: HouseAction = house.pays_security
                  ? 'deactivate-security'
                  : 'activate-security'
                const isConfirmingActive = isConfirmingHouseAction(
                  house.id,
                  activeAction,
                )
                const isConfirmingSecurity = isConfirmingHouseAction(
                  house.id,
                  securityAction,
                )

                      return (
              <article
                key={house.id}
                className={`rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ${
                  !house.is_active ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {profile?.role === 'super_admin'
                        ? house.residentialName
                        : 'Casa'}
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                      {house.block}-{house.house_number}
                    </h2>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        house.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {house.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        house.pays_security
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {house.pays_security ? 'Seguridad sí' : 'Sin seguridad'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Aprobados
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                      {house.approvedResidents}/{house.resident_limit || 3}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Pendientes
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                      {house.pendingResidents}
                    </p>
                  </div>
                </div>

                {house.notes && (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {house.notes}
                  </p>
                )}

                <div className="mt-4 grid gap-2">
                  <Link
                    href={`/dashboard/houses/${house.id}`}
                    className="min-h-10 w-full rounded-xl bg-slate-950 dark:bg-slate-700 px-4 py-2 text-center text-sm font-semibold text-white active:scale-[0.99]"
                  >
                    Ver y administrar
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleToggleSecurity(house)}
                    disabled={updatingHouseId === house.id}
                    className={`min-h-10 w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 active:scale-[0.99] ${
                      isConfirmingSecurity
                        ? 'bg-amber-500 text-white'
                        : 'border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {isConfirmingSecurity
                      ? house.pays_security
                        ? 'Confirmar quitar seguridad'
                        : 'Confirmar activar seguridad'
                      : house.pays_security
                        ? 'Quitar seguridad'
                        : 'Activar seguridad'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(house)}
                    disabled={updatingHouseId === house.id}
                    className={`min-h-10 w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 active:scale-[0.99] ${
                      isConfirmingActive
                        ? 'bg-red-600 text-white'
                        : house.is_active
                        ? 'border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                        : 'bg-slate-950 dark:bg-slate-700 text-white'
                    }`}
                  >
                    {isConfirmingActive
                      ? house.is_active
                        ? 'Confirmar desactivar casa'
                        : 'Confirmar activar casa'
                      : house.is_active
                        ? 'Desactivar casa'
                        : 'Activar casa'}
                  </button>
                </div>
              </article>
                      )
                    })()
                  ))}
                </div>
              </section>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
