'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type HouseDetail = {
  id: string
  residential_id: string
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: number | null
  is_active: boolean | null
  notes: string | null
  residentials: {
    id: string
    name: string
  } | null
}

type HouseRow = Omit<HouseDetail, 'residentials'> & {
  residentials:
    | {
        id: string
        name: string
      }
    | {
        id: string
        name: string
      }[]
    | null
}

type ResidentProfile = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
}

type HousePageProps = {
  params: Promise<{ id: string }>
}

export default function HouseDetailPage({ params }: HousePageProps) {
  const { id } = use(params)

  const [house, setHouse] = useState<HouseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [residents, setResidents] = useState<ResidentProfile[]>([])
  const [loadingResidents, setLoadingResidents] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [currentUserIsResidentialAdmin, setCurrentUserIsResidentialAdmin] =
    useState(false)
  const [togglingSecurity, setTogglingSecurity] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)
  const [confirmingHouseDeactivate, setConfirmingHouseDeactivate] =
    useState(false)
  const [removingResidentId, setRemovingResidentId] = useState<string | null>(null)
  const [confirmRemoveResidentId, setConfirmRemoveResidentId] = useState<string | null>(null)

  // Auto-cancel the confirmation state after 5 s if user doesn't confirm
  useEffect(() => {
    if (!confirmingDeactivate) return
    const timer = setTimeout(() => setConfirmingDeactivate(false), 5000)
    return () => clearTimeout(timer)
  }, [confirmingDeactivate])

  useEffect(() => {
    if (!confirmingHouseDeactivate) return
    const timer = setTimeout(() => setConfirmingHouseDeactivate(false), 5000)
    return () => clearTimeout(timer)
  }, [confirmingHouseDeactivate])

  useEffect(() => {
    if (!confirmRemoveResidentId) return
    const timer = setTimeout(() => setConfirmRemoveResidentId(null), 5000)
    return () => clearTimeout(timer)
  }, [confirmRemoveResidentId])

  const loadHouse = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('houses')
      .select(
        'id,residential_id,block,house_number,pays_security,resident_limit,is_active,notes,residentials(id,name)'
      )
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error loading house:', error)
      toast.error('No se pudo cargar la casa')
      setHouse(null)
      setLoading(false)
      return
    }

    const houseRow = data as HouseRow
    setHouse({
      ...houseRow,
      residentials: Array.isArray(houseRow.residentials)
        ? houseRow.residentials[0] || null
        : houseRow.residentials,
    })
    setLoading(false)
  }

  const loadResidents = async () => {
    setLoadingResidents(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,phone,status')
      .eq('house_id', id)
      .eq('role', 'resident')
      .order('last_name', { ascending: true })

    if (error) {
      console.error('Error loading residents for house:', error)
      toast.error('No se pudieron cargar los residentes')
      setLoadingResidents(false)
      return
    }

    setResidents(data || [])
    setLoadingResidents(false)
  }

  const loadCurrentUser = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const { data } = await supabase
      .from('profiles')
      .select('role,is_residential_admin')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (data) {
      setCurrentUserRole(data.role)
      setCurrentUserIsResidentialAdmin(Boolean(data.is_residential_admin))
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadHouse)
    void Promise.resolve().then(loadResidents)
    void Promise.resolve().then(loadCurrentUser)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleToggleSecurity = async () => {
    if (!house) return

    const newValue = !house.pays_security

    if (!newValue) {
      // Deactivating — require a second tap to confirm
      if (!confirmingDeactivate) {
        setConfirmingDeactivate(true)
        toast.warning(
          `¿Desactivar acceso en ${house.block}-${house.house_number}? Toca de nuevo para confirmar.`,
        )
        return
      }
      setConfirmingDeactivate(false)
    }

    setTogglingSecurity(true)

    const { data, error } = await supabase
      .from('houses')
      .update({ pays_security: newValue })
      .eq('id', id)
      .select('pays_security')
      .single()

    if (error || !data) {
      console.error('Error updating pays_security:', error)
      toast.error('No se pudo actualizar el estado de seguridad')
      setTogglingSecurity(false)
      return
    }

    setHouse({ ...house, pays_security: data.pays_security })
    toast.success(newValue ? 'Acceso activado' : 'Acceso desactivado')
    setTogglingSecurity(false)
  }

  const handleToggleHouseActive = async () => {
    if (!house || !canManageSecurity) return

    const newValue = !house.is_active

    if (!newValue) {
      if (!confirmingHouseDeactivate) {
        setConfirmingHouseDeactivate(true)
        toast.warning(
          `Toca de nuevo para desactivar la casa ${house.block}-${house.house_number}.`,
        )
        return
      }
      setConfirmingHouseDeactivate(false)
    }

    setTogglingActive(true)

    const payload = newValue
      ? { is_active: true }
      : { is_active: false, pays_security: false }

    const { data, error } = await supabase
      .from('houses')
      .update(payload)
      .eq('id', id)
      .select('is_active,pays_security')
      .single()

    setTogglingActive(false)

    if (error || !data) {
      console.error('Error updating house active state:', error)
      toast.error('No se pudo actualizar la casa')
      return
    }

    setHouse({
      ...house,
      is_active: data.is_active,
      pays_security: data.pays_security,
    })
    toast.success(newValue ? 'Casa activada' : 'Casa desactivada')
  }

  const handleRemoveResident = async (resident: ResidentProfile) => {
    if (!canManageSecurity) return

    if (confirmRemoveResidentId !== resident.id) {
      setConfirmRemoveResidentId(resident.id)
      toast.warning(
        `Toca de nuevo para quitar a ${resident.first_name} ${resident.last_name} de esta casa.`,
      )
      return
    }

    setRemovingResidentId(resident.id)
    setConfirmRemoveResidentId(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        house_id: null,
        status: 'inactive',
      })
      .eq('id', resident.id)
      .eq('role', 'resident')

    setRemovingResidentId(null)

    if (error) {
      console.error('Error removing resident from house:', error)
      toast.error('No se pudo quitar el residente')
      return
    }

    toast.success('Residente quitado de la casa')
    await loadResidents()
  }

  const approvedCount = residents.filter((r) => r.status === 'approved').length
  const pendingCount = residents.filter((r) => r.status === 'pending').length
  const canManageSecurity =
    currentUserRole === 'admin' ||
    currentUserRole === 'super_admin' ||
    currentUserIsResidentialAdmin

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-28 rounded-full bg-slate-200" />
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="h-4 w-24 rounded-full bg-slate-200" />
            <div className="mt-3 h-8 w-36 rounded-full bg-slate-200" />
            <div className="mt-4 h-4 w-48 rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-40 rounded-full bg-slate-200" />
          </section>
          <section className="grid gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="h-4 w-32 rounded-full bg-slate-200" />
                <div className="mt-3 h-7 w-16 rounded-full bg-slate-200" />
              </div>
            ))}
          </section>
        </div>
      </main>
    )
  }

  if (!house) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-lg font-bold text-slate-900">Casa no encontrada</p>
          <p className="mt-2 text-sm text-slate-500">
            No pudimos cargar la información de esta casa.
          </p>
          <Link
            href="/dashboard/residentials"
            className="mt-5 block min-h-12 rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white active:scale-[0.99]"
          >
            Volver a residenciales
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
            href={`/dashboard/residentials/${house.residential_id}`}
            className="min-h-11 rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm active:scale-[0.99]"
          >
            Residencial
          </Link>
        </nav>
        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Casa</p>
          <h1 className="mt-1 text-3xl font-bold">
            {house.block}-{house.house_number}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {house.residentials?.name || 'Residencial no disponible'}
          </p>
          <div className="mt-5 grid gap-2 text-sm text-slate-200">
            <p>
              Usuarios app permitidos:{' '}
              <span className="font-semibold text-white">
                {house.resident_limit || 3}
              </span>
            </p>
          </div>
        </header>

        {/* Estado general */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">Estado</p>
              <p className="mt-1 text-xl font-bold text-slate-950">
                {house.is_active ? 'Activo' : 'Inactivo'}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                house.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {house.is_active ? 'Activa' : 'Inactiva'}
            </span>
          </div>

          {house.notes && (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {house.notes}
            </p>
          )}

          {canManageSecurity && (
            <button
              type="button"
              onClick={() => void handleToggleHouseActive()}
              disabled={togglingActive}
              className={`mt-4 min-h-12 w-full rounded-2xl px-4 py-3 font-semibold disabled:opacity-60 active:scale-[0.99] ${
                house.is_active
                  ? confirmingHouseDeactivate
                    ? 'bg-red-700 text-white'
                    : 'border border-red-200 text-red-700'
                  : 'bg-slate-950 text-white'
              }`}
            >
              {togglingActive
                ? 'Actualizando...'
                : house.is_active
                  ? confirmingHouseDeactivate
                    ? 'Confirmar desactivar casa'
                    : 'Desactivar casa'
                  : 'Activar casa'}
            </button>
          )}
        </section>

        {/* Control de seguridad */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Seguridad activa
              </p>
              <p className="mt-1 text-xl font-bold text-slate-950">
                {house.pays_security ? 'Sí' : 'No'}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                house.pays_security
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {house.pays_security ? 'Activa' : 'Inactiva'}
            </span>
          </div>

          {!house.pays_security && (
            <p className="mt-3 text-sm leading-5 text-slate-500">
              Los residentes de esta casa no pueden crear visitas mientras la seguridad esté desactivada.
            </p>
          )}

          {canManageSecurity && (
            <button
              type="button"
              onClick={handleToggleSecurity}
              disabled={togglingSecurity}
              className={`mt-4 min-h-12 w-full rounded-2xl px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99] transition-colors ${
                house.pays_security
                  ? confirmingDeactivate
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-red-500 hover:bg-red-600'
                  : 'bg-[#15936A] hover:bg-[#0E6B4E]'
              }`}
            >
              {togglingSecurity
                ? 'Actualizando...'
                : house.pays_security
                  ? confirmingDeactivate
                    ? '¿Confirmar desactivación?'
                    : 'Desactivar seguridad'
                  : 'Activar acceso'}
            </button>
          )}
        </section>

        <section className="grid gap-3">
          <KpiCard
            label="Residentes aprobados"
            value={loadingResidents ? '–' : String(approvedCount)}
          />
          <KpiCard
            label="Residentes pendientes"
            value={loadingResidents ? '–' : String(pendingCount)}
          />
          <KpiCard label="Visitas activas" value="0" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Residentes</p>
          {loadingResidents ? (
            <p className="mt-3 text-sm text-slate-400">Cargando residentes...</p>
          ) : residents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              No hay residentes registrados en esta casa.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {residents.map((resident) => (
                <li
                  key={resident.id}
                  className="space-y-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {resident.first_name} {resident.last_name}
                      </p>
                      {resident.phone && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {resident.phone}
                        </p>
                      )}
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        resident.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : resident.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : resident.status === 'inactive'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {resident.status === 'approved'
                        ? 'Aprobado'
                        : resident.status === 'pending'
                          ? 'Pendiente'
                          : resident.status === 'inactive'
                            ? 'Inactivo'
                            : resident.status}
                    </span>
                  </div>
                  {canManageSecurity && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveResident(resident)}
                      disabled={removingResidentId === resident.id}
                      className={`min-h-10 w-full rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60 active:scale-[0.99] ${
                        confirmRemoveResidentId === resident.id
                          ? 'bg-red-600 text-white'
                          : 'border border-red-200 text-red-700'
                      }`}
                    >
                      {removingResidentId === resident.id
                        ? 'Quitando...'
                        : confirmRemoveResidentId === resident.id
                          ? 'Confirmar quitar residente'
                          : 'Quitar de esta casa'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </main>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </article>
  )
}
