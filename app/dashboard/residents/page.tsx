'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type ResidentStatus = 'pending' | 'approved' | 'rejected'

type ResidentProfile = {
  id: string
  residential_id: string | null
  house_id: string | null
  first_name: string
  last_name: string
  phone: string | null
  status: ResidentStatus
  role: 'resident'
  residential: ResidentialSummary | null
  house: HouseSummary | null
}

type ResidentProfileRow = Omit<ResidentProfile, 'residential' | 'house'>

type ResidentialSummary = {
  id: string
  name: string
}

type HouseSummary = {
  id: string
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: number | null
}

const filters: { label: string; value: ResidentStatus }[] = [
  { label: 'Pendientes', value: 'pending' },
  { label: 'Aprobados', value: 'approved' },
  { label: 'Rechazados', value: 'rejected' },
]

export default function ResidentsPage() {
  const [residents, setResidents] = useState<ResidentProfile[]>([])
  const [selectedStatus, setSelectedStatus] = useState<ResidentStatus>('pending')
  const [loading, setLoading] = useState(true)
  const [savingResidentId, setSavingResidentId] = useState<string | null>(null)

  const loadResidents = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id,first_name,last_name,phone,status,role,residential_id,house_id'
      )
      .eq('role', 'resident')
      .in('status', ['pending', 'approved', 'rejected'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading residents:', error)
      toast.error('No se pudieron cargar los residentes')
      setResidents([])
      setLoading(false)
      return
    }

    const rows = (data || []) as ResidentProfileRow[]
    const residentialIds = Array.from(
      new Set(
        rows
          .map((resident) => resident.residential_id)
          .filter((residentialId): residentialId is string =>
            Boolean(residentialId)
          )
      )
    )
    const houseIds = Array.from(
      new Set(
        rows
          .map((resident) => resident.house_id)
          .filter((houseId): houseId is string => Boolean(houseId))
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
      console.error('Error loading resident residentials:', residentialsError)
      toast.error('No se pudieron cargar los residenciales')
      setResidents([])
      setLoading(false)
      return
    }

    const { data: housesData, error: housesError } =
      houseIds.length > 0
        ? await supabase
            .from('houses')
            .select('id,block,house_number,pays_security,resident_limit')
            .in('id', houseIds)
        : { data: [], error: null }

    if (housesError) {
      console.error('Error loading resident houses:', housesError)
      toast.error('No se pudieron cargar las casas')
      setResidents([])
      setLoading(false)
      return
    }

    const residentialById = new Map(
      ((residentialsData || []) as ResidentialSummary[]).map((residential) => [
        residential.id,
        residential,
      ])
    )
    const houseById = new Map(
      ((housesData || []) as HouseSummary[]).map((house) => [house.id, house])
    )

    const enrichedResidents: ResidentProfile[] = rows.map((resident) => ({
      ...resident,
      residential: resident.residential_id
        ? residentialById.get(resident.residential_id) || null
        : null,
      house: resident.house_id ? houseById.get(resident.house_id) || null : null,
    }))

    setResidents(enrichedResidents)
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadResidents)
  }, [])

  const handleUpdateStatus = async (
    resident: ResidentProfile,
    status: ResidentStatus
  ) => {
    setSavingResidentId(resident.id)

    if (status === 'approved') {
      if (!resident.house_id) {
        toast.error('Este residente no tiene una casa asignada')
        setSavingResidentId(null)
        return
      }

      if (!resident.house) {
        toast.error('No se pudo validar la casa del residente')
        setSavingResidentId(null)
        return
      }

      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('house_id', resident.house_id)
        .eq('role', 'resident')
        .eq('status', 'approved')

      if (countError) {
        console.error('Error counting approved residents:', countError)
        toast.error('No se pudo validar el cupo de la casa')
        setSavingResidentId(null)
        return
      }

      const residentLimit = resident.house.resident_limit || 3

      if ((count || 0) >= residentLimit) {
        toast.error('Esta casa ya alcanzó el máximo de usuarios app permitidos')
        setSavingResidentId(null)
        return
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', resident.id)
      .eq('role', 'resident')

    setSavingResidentId(null)

    if (error) {
      console.error('Error updating resident status:', error)
      toast.error('No se pudo actualizar el residente')
      return
    }

    toast.success(
      status === 'approved'
        ? 'Residente aprobado correctamente'
        : 'Residente rechazado correctamente'
    )

    loadResidents()
  }

  const filteredResidents = residents.filter(
    (resident) => resident.status === selectedStatus
  )

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <Link
          href="/dashboard"
          className="block text-sm font-semibold text-slate-600"
        >
          ← Volver al dashboard
        </Link>

        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Administración</p>
          <h1 className="mt-1 text-2xl font-bold">Residentes</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Revisa solicitudes y controla quién puede anunciar visitas desde la
            app.
          </p>
        </header>

        <section className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 shadow-sm">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setSelectedStatus(filter.value)}
              className={`min-h-12 rounded-xl px-3 text-sm font-semibold active:scale-[0.99] ${
                selectedStatus === filter.value
                  ? 'bg-slate-950 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </section>

        {loading ? (
          <ResidentsSkeleton />
        ) : filteredResidents.length === 0 ? (
          <section className="rounded-2xl bg-white p-6 text-sm leading-6 text-slate-500 shadow-sm">
            No hay residentes en este estado.
          </section>
        ) : (
          <section className="space-y-3">
            {filteredResidents.map((resident) => (
              <ResidentCard
                key={resident.id}
                resident={resident}
                saving={savingResidentId === resident.id}
                onApprove={() => handleUpdateStatus(resident, 'approved')}
                onReject={() => handleUpdateStatus(resident, 'rejected')}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function ResidentCard({
  resident,
  saving,
  onApprove,
  onReject,
}: {
  resident: ResidentProfile
  saving: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const fullName = `${resident.first_name} ${resident.last_name}`.trim()
  const houseLabel = resident.house
    ? `${resident.house.block}-${resident.house.house_number}`
    : 'Sin casa'

  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {fullName || 'Sin nombre'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {resident.phone || 'Sin teléfono'}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            resident.status === 'approved'
              ? 'bg-green-100 text-green-700'
              : resident.status === 'rejected'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
          }`}
        >
          {getStatusLabel(resident.status)}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-slate-800">Residencial:</span>{' '}
          {resident.residential?.name || 'Sin residencial'}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Casa:</span>{' '}
          {houseLabel}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Paga seguridad:</span>{' '}
          {resident.house?.pays_security ? 'Sí' : 'No'}
        </p>
        <p>
          <span className="font-semibold text-slate-800">
            Usuarios app permitidos:
          </span>{' '}
          {resident.house?.resident_limit || 3}
        </p>
      </div>

      {resident.status === 'pending' && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onReject}
            disabled={saving}
            className="min-h-12 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-60 active:scale-[0.99]"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={saving}
            className="min-h-12 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
          >
            {saving ? 'Guardando...' : 'Aprobar'}
          </button>
        </div>
      )}
    </article>
  )
}

function ResidentsSkeleton() {
  return (
    <section className="space-y-3">
      {[0, 1, 2].map((item) => (
        <article key={item} className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="h-5 w-36 rounded-full bg-slate-200" />
              <div className="h-4 w-24 rounded-full bg-slate-200" />
            </div>
            <div className="h-7 w-20 rounded-full bg-slate-200" />
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-4 w-44 rounded-full bg-slate-200" />
            <div className="h-4 w-32 rounded-full bg-slate-200" />
            <div className="h-4 w-40 rounded-full bg-slate-200" />
          </div>
        </article>
      ))}
    </section>
  )
}

function getStatusLabel(status: ResidentStatus) {
  if (status === 'approved') {
    return 'Aprobado'
  }

  if (status === 'rejected') {
    return 'Rechazado'
  }

  return 'Pendiente'
}
