'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/ui'

type ProfileRole = 'super_admin' | 'admin' | 'resident' | 'guard'
type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'inactive'

type CurrentProfile = {
  id: string
  residential_id: string | null
  role: ProfileRole
  status: ProfileStatus
  is_residential_admin: boolean | null
}

type VisitorEntry = {
  id: string
  residential_id: string
  visit_id: string | null
  house_id: string
  guard_id: string
  entry_status: 'allowed' | 'denied'
  entry_time: string
  exit_time: string | null
}

type VisitSummary = {
  id: string
  visitor_name: string
  visit_type: string
}

type HouseSummary = {
  id: string
  block: string
  house_number: string
}

type ResidentialSummary = {
  id: string
  name: string
}

type GuardSummary = {
  id: string
  first_name: string
  last_name: string
}

type EntryCard = VisitorEntry & {
  visit: VisitSummary | null
  house: HouseSummary | null
  residential: ResidentialSummary | null
  guard: GuardSummary | null
}

const allowedRoles: ProfileRole[] = ['guard', 'admin', 'super_admin']

const visitTypeLabels: Record<string, string> = {
  family: 'Familiar',
  delivery: 'Delivery',
  service: 'Servicio',
  provider: 'Proveedor',
  other: 'Otro',
}

const canAccessPage = (profile: CurrentProfile | null) =>
  Boolean(
    profile &&
      profile.status === 'approved' &&
      (allowedRoles.includes(profile.role) ||
        Boolean(profile.is_residential_admin)),
  )

const uniqueIds = (ids: Array<string | null>) =>
  Array.from(new Set(ids.filter((id): id is string => Boolean(id))))

export default function InsideDashboardPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [entries, setEntries] = useState<EntryCard[]>([])
  const [loading, setLoading] = useState(true)

  const loadEntries = useCallback(async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      window.location.href = '/login'
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,residential_id,role,status,is_residential_admin')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError || !profileData) {
      console.error('Error cargando perfil:', profileError)
      toast.error('No se pudo cargar tu perfil')
      setLoading(false)
      return
    }

    const currentProfile = profileData as CurrentProfile
    setProfile(currentProfile)

    if (!canAccessPage(currentProfile)) {
      setEntries([])
      setLoading(false)
      return
    }

    let query = supabase
      .from('visitor_entries')
      .select('id,residential_id,visit_id,house_id,guard_id,entry_status,entry_time,exit_time')
      .eq('entry_status', 'allowed')
      .is('exit_time', null)
      .order('entry_time', { ascending: false })
      .limit(40)

    if (currentProfile.role !== 'super_admin') {
      if (!currentProfile.residential_id) {
        toast.error('Tu perfil no tiene residencial asignado')
        setEntries([])
        setLoading(false)
        return
      }
      query = query.eq('residential_id', currentProfile.residential_id)
    }

    const { data: entriesData, error: entriesError } = await query
    if (entriesError) {
      console.error('Error cargando visitantes dentro:', entriesError)
      toast.error('No se pudieron cargar las visitas dentro')
      setLoading(false)
      return
    }

    const loadedEntries = (entriesData || []) as VisitorEntry[]
    const visitIds = uniqueIds(loadedEntries.map((entry) => entry.visit_id))
    const houseIds = uniqueIds(loadedEntries.map((entry) => entry.house_id))
    const residentialIds = uniqueIds(loadedEntries.map((entry) => entry.residential_id))
    const guardIds = uniqueIds(loadedEntries.map((entry) => entry.guard_id))

    const visitsById: Record<string, VisitSummary> = {}
    const housesById: Record<string, HouseSummary> = {}
    const residentialsById: Record<string, ResidentialSummary> = {}
    const guardsById: Record<string, GuardSummary> = {}

    if (visitIds.length > 0) {
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('id,visitor_name,visit_type')
        .in('id', visitIds)

      if (visitsError) {
        console.error('Error cargando visitas:', visitsError)
        toast.error('No se pudieron cargar los datos de visitas')
      } else {
        ;((visitsData || []) as VisitSummary[]).forEach((visit) => {
          visitsById[visit.id] = visit
        })
      }
    }

    if (houseIds.length > 0) {
      const { data: housesData, error: housesError } = await supabase
        .from('houses')
        .select('id,block,house_number')
        .in('id', houseIds)

      if (housesError) {
        console.error('Error cargando casas:', housesError)
        toast.error('No se pudieron cargar los datos de casas')
      } else {
        ;((housesData || []) as HouseSummary[]).forEach((house) => {
          housesById[house.id] = house
        })
      }
    }

    if (residentialIds.length > 0) {
      const { data: residentialsData, error: residentialsError } = await supabase
        .from('residentials')
        .select('id,name')
        .in('id', residentialIds)

      if (residentialsError) {
        console.error('Error cargando residenciales:', residentialsError)
        toast.error('No se pudieron cargar los datos de residenciales')
      } else {
        ;((residentialsData || []) as ResidentialSummary[]).forEach((residential) => {
          residentialsById[residential.id] = residential
        })
      }
    }

    if (guardIds.length > 0) {
      const { data: guardsData, error: guardsError } = await supabase
        .from('profiles')
        .select('id,first_name,last_name')
        .in('id', guardIds)

      if (guardsError) {
        console.error('Error cargando guardias:', guardsError)
        toast.error('No se pudieron cargar los datos de guardias')
      } else {
        ;((guardsData || []) as GuardSummary[]).forEach((guard) => {
          guardsById[guard.id] = guard
        })
      }
    }

    setEntries(
      loadedEntries.map((entry) => ({
        ...entry,
        visit: entry.visit_id ? visitsById[entry.visit_id] || null : null,
        house: housesById[entry.house_id] || null,
        residential: residentialsById[entry.residential_id] || null,
        guard: guardsById[entry.guard_id] || null,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadEntries()
    })
  }, [loadEntries])

  const hasAccess = useMemo(() => canAccessPage(profile), [profile])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-6 w-40 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div className="h-5 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-4 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div className="h-5 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-4 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-4 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Dentro</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">Acceso no autorizado</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Solo guardias, administradores y super administradores aprobados pueden ver los visitantes dentro.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 block w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 text-center font-semibold text-white"
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
        <Link href="/dashboard" className="block text-sm font-semibold text-slate-600 dark:text-slate-300">
          ← Volver al dashboard
        </Link>

        <header className="rounded-2xl bg-slate-950 dark:bg-slate-800 p-6 text-white shadow-sm">
          <p className="text-sm text-slate-300">Dentro actualmente</p>
          <h1 className="mt-2 text-2xl font-bold">Visitantes dentro</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Estas son las visitas que ya entraron y aún no han salido.
          </p>
        </header>

        {entries.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No hay visitantes dentro"
            description="Las visitas sin salida registrada apareceran aqui."
          />
        ) : (
          <section className="space-y-4">
            {entries.map((entry) => {
              const entryTime = new Intl.DateTimeFormat('es-ES', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(entry.entry_time))

              const guestName = entry.visit?.visitor_name || 'Visitante'
              const visitType = entry.visit?.visit_type
                ? visitTypeLabels[entry.visit.visit_type] || 'Otro'
                : 'Tipo no definido'
              const houseLabel = entry.house
                ? `${entry.house.block}-${entry.house.house_number}`
                : 'Casa no disponible'
              const residentialLabel = entry.residential?.name || 'Residencial no disponible'
              const guardLabel = entry.guard
                ? `${entry.guard.first_name} ${entry.guard.last_name}`
                : 'Guardia no disponible'

              return (
                <article key={entry.id} className="overflow-hidden rounded-3xl bg-white dark:bg-slate-800 shadow-sm">
                  <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-950 dark:bg-slate-700 p-5 text-white">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Visitante</p>
                    <h2 className="mt-2 text-xl font-bold">{guestName}</h2>
                    <p className="mt-1 text-sm text-slate-300">{visitType}</p>
                  </div>
                  <div className="space-y-3 p-5">
                    <InfoBlock label="Casa" value={houseLabel} />
                    <InfoBlock label="Residencial" value={residentialLabel} />
                    <InfoBlock label="Hora de entrada" value={entryTime} />
                    <InfoBlock label="Guardia" value={guardLabel} />
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

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 dark:bg-slate-700/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}
