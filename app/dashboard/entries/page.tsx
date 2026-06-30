'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
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
  created_at: string
}

type VisitSummary = {
  id: string
  visitor_name: string
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

const canViewEntries = (profile: CurrentProfile | null) =>
  Boolean(
    profile &&
      profile.status === 'approved' &&
      ['guard', 'admin', 'super_admin'].includes(profile.role),
  )

const uniqueIds = (ids: Array<string | null>) =>
  Array.from(new Set(ids.filter((id): id is string => Boolean(id))))

export default function EntriesPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [entries, setEntries] = useState<EntryCard[]>([])
  const [loading, setLoading] = useState(true)

  const loadEntries = useCallback(async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesion para ver entradas recientes')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,residential_id,role,status')
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

    if (!canViewEntries(currentProfile)) {
      setEntries([])
      setLoading(false)
      return
    }

    let entriesQuery = supabase
      .from('visitor_entries')
      .select(
        'id,residential_id,visit_id,house_id,guard_id,entry_status,entry_time,exit_time,created_at',
      )
      .order('entry_time', { ascending: false })
      .limit(40)

    if (currentProfile.role !== 'super_admin') {
      if (!currentProfile.residential_id) {
        toast.error('Tu perfil no tiene residencial asignado')
        setEntries([])
        setLoading(false)
        return
      }

      entriesQuery = entriesQuery.eq(
        'residential_id',
        currentProfile.residential_id,
      )
    }

    const { data: entriesData, error: entriesError } = await entriesQuery

    if (entriesError) {
      console.error('Error loading visitor entries:', entriesError)
      toast.error(entriesError.message)
      setEntries([])
      setLoading(false)
      return
    }

    const loadedEntries = (entriesData || []) as VisitorEntry[]
    const visitIds = uniqueIds(loadedEntries.map((entry) => entry.visit_id))
    const houseIds = uniqueIds(loadedEntries.map((entry) => entry.house_id))
    const residentialIds = uniqueIds(
      loadedEntries.map((entry) => entry.residential_id),
    )
    const guardIds = uniqueIds(loadedEntries.map((entry) => entry.guard_id))

    const visitsById: Record<string, VisitSummary> = {}
    const housesById: Record<string, HouseSummary> = {}
    const residentialsById: Record<string, ResidentialSummary> = {}
    const guardsById: Record<string, GuardSummary> = {}

    if (visitIds.length > 0) {
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('id,visitor_name')
        .in('id', visitIds)

      if (visitsError) {
        console.error('Error loading entry visits:', visitsError)
        toast.error('No se pudieron cargar los visitantes')
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
        console.error('Error loading entry houses:', housesError)
        toast.error('No se pudieron cargar las casas')
      } else {
        ;((housesData || []) as HouseSummary[]).forEach((house) => {
          housesById[house.id] = house
        })
      }
    }

    if (residentialIds.length > 0) {
      const { data: residentialsData, error: residentialsError } =
        await supabase
          .from('residentials')
          .select('id,name')
          .in('id', residentialIds)

      if (residentialsError) {
        console.error('Error loading entry residentials:', residentialsError)
        toast.error('No se pudieron cargar los residenciales')
      } else {
        ;((residentialsData || []) as ResidentialSummary[]).forEach(
          (residential) => {
            residentialsById[residential.id] = residential
          },
        )
      }
    }

    if (guardIds.length > 0) {
      const { data: guardsData, error: guardsError } = await supabase
        .from('profiles')
        .select('id,first_name,last_name')
        .in('id', guardIds)

      if (guardsError) {
        console.error('Error loading entry guards:', guardsError)
        toast.error('No se pudieron cargar los guardias')
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
    void Promise.resolve().then(loadEntries)
  }, [loadEntries])

  const isAllowed = useMemo(() => canViewEntries(profile), [profile])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div className="h-5 w-36 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-4 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
          </section>
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div className="h-5 w-40 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-4 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-4 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
          </section>
        </div>
      </main>
    )
  }

  if (!isAllowed) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Entradas recientes
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            Acceso no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Solo guardias, administradores y super administradores aprobados
            pueden ver esta bitacora.
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

        <header className="rounded-2xl bg-slate-950 dark:bg-slate-800 p-6 text-white shadow-sm">
          <p className="text-sm text-slate-300">Garita</p>
          <h1 className="mt-1 text-2xl font-bold">Entradas recientes</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Últimos ingresos registrados por seguridad.
          </p>
        </header>

        {entries.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No hay ingresos registrados"
            description="Cuando el guardia registre accesos, apareceran aqui."
          />
        ) : (
          <section className="space-y-3">
            {entries.map((entry) => {
              const entryDate = new Intl.DateTimeFormat('es-HN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(entry.entry_time))
              const exitDate = entry.exit_time
                ? new Intl.DateTimeFormat('es-HN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(entry.exit_time))
                : null
              const houseLabel = entry.house
                ? `${entry.house.block}-${entry.house.house_number}`
                : 'Casa no disponible'
              const isInside = !entry.exit_time && entry.entry_status === 'allowed'
              const exitLabel = exitDate || 'Pendiente'

              return (
                <article
                  key={entry.id}
                  className="space-y-4 rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                        Visitante
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                        {entry.visit?.visitor_name || 'No disponible'}
                      </h2>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        isInside
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-orange-100 text-orange-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {isInside ? 'Dentro' : 'Salió'}
                    </span>
                  </div>

                  <div className="grid gap-3">
                    <InfoBlock label="Casa" value={houseLabel} />
                    <InfoBlock
                      label="Residencial"
                      value={entry.residential?.name || 'No disponible'}
                    />
                    <InfoBlock label="Hora de entrada" value={entryDate} />
                    <InfoBlock label="Hora de salida" value={exitLabel} />
                    <InfoBlock
                      label="Guardia"
                      value={
                        entry.guard
                          ? `${entry.guard.first_name} ${entry.guard.last_name}`
                          : 'No disponible'
                      }
                    />
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
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}
