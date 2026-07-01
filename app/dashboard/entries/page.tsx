'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { EmptyState, StatusBadge } from '@/components/ui'

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
  created_at: string
}

type EventGuestEntry = {
  id: string
  residential_id: string
  event_id: string
  event_guest_id: string
  guard_id: string
  action: 'entry' | 'exit'
  occurred_at: string
  created_at: string
}

type VisitSummary = {
  id: string
  visitor_name: string
}

type EventSummary = {
  id: string
  title: string
  house_id: string
}

type EventGuestSummary = {
  id: string
  guest_name: string
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

type VisitEntryCard = VisitorEntry & {
  kind: 'visit'
  sortTime: string
  visit: VisitSummary | null
  house: HouseSummary | null
  residential: ResidentialSummary | null
  guard: GuardSummary | null
}

type EventEntryCard = EventGuestEntry & {
  kind: 'event'
  sortTime: string
  event: EventSummary | null
  guest: EventGuestSummary | null
  house: HouseSummary | null
  residential: ResidentialSummary | null
  guard: GuardSummary | null
}

type EntryCard = VisitEntryCard | EventEntryCard

type EventEntryGroup = {
  kind: 'event_group'
  id: string
  sortTime: string
  event: EventSummary | null
  house: HouseSummary | null
  residential: ResidentialSummary | null
  entries: EventEntryCard[]
  entryCount: number
  exitCount: number
}

type EntryListItem = VisitEntryCard | EventEntryGroup

const canViewEntries = (profile: CurrentProfile | null) =>
  Boolean(
      profile &&
      profile.status === 'approved' &&
      (['guard', 'admin', 'super_admin'].includes(profile.role) ||
        Boolean(profile.is_residential_admin)),
  )

const uniqueIds = (ids: Array<string | null>) =>
  Array.from(new Set(ids.filter((id): id is string => Boolean(id))))

export default function EntriesPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [entries, setEntries] = useState<EntryCard[]>([])
  const [expandedEventGroupId, setExpandedEventGroupId] = useState<
    string | null
  >(null)
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
      .select('id,residential_id,role,status,is_residential_admin')
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

    let eventEntriesQuery = supabase
      .from('event_guest_entries')
      .select(
        'id,residential_id,event_id,event_guest_id,guard_id,action,occurred_at,created_at',
      )
      .order('occurred_at', { ascending: false })
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
      eventEntriesQuery = eventEntriesQuery.eq(
        'residential_id',
        currentProfile.residential_id,
      )
    }

    const [
      { data: entriesData, error: entriesError },
      { data: eventEntriesData, error: eventEntriesError },
    ] = await Promise.all([entriesQuery, eventEntriesQuery])

    if (entriesError) {
      console.error('Error loading visitor entries:', entriesError)
      toast.error(entriesError.message)
      setEntries([])
      setLoading(false)
      return
    }

    if (eventEntriesError) {
      console.error('Error loading event entries:', eventEntriesError)
      toast.error(eventEntriesError.message)
    }

    const loadedEntries = (entriesData || []) as VisitorEntry[]
    const loadedEventEntries = (eventEntriesData || []) as EventGuestEntry[]
    const visitIds = uniqueIds(loadedEntries.map((entry) => entry.visit_id))
    const eventIds = uniqueIds(
      loadedEventEntries.map((entry) => entry.event_id),
    )
    const eventGuestIds = uniqueIds(
      loadedEventEntries.map((entry) => entry.event_guest_id),
    )
    const residentialIds = uniqueIds(
      [
        ...loadedEntries.map((entry) => entry.residential_id),
        ...loadedEventEntries.map((entry) => entry.residential_id),
      ],
    )
    const guardIds = uniqueIds([
      ...loadedEntries.map((entry) => entry.guard_id),
      ...loadedEventEntries.map((entry) => entry.guard_id),
    ])

    const visitsById: Record<string, VisitSummary> = {}
    const eventsById: Record<string, EventSummary> = {}
    const eventGuestsById: Record<string, EventGuestSummary> = {}
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

    if (eventGuestIds.length > 0) {
      const { data: eventGuestsData, error: eventGuestsError } = await supabase
        .from('event_guests')
        .select('id,guest_name')
        .in('id', eventGuestIds)

      if (eventGuestsError) {
        console.error('Error loading event guests:', eventGuestsError)
        toast.error('No se pudieron cargar los invitados de eventos')
      } else {
        ;((eventGuestsData || []) as EventGuestSummary[]).forEach((guest) => {
          eventGuestsById[guest.id] = guest
        })
      }
    }

    if (eventIds.length > 0) {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id,title,house_id')
        .in('id', eventIds)

      if (eventsError) {
        console.error('Error loading entry events:', eventsError)
        toast.error('No se pudieron cargar los eventos')
      } else {
        ;((eventsData || []) as EventSummary[]).forEach((event) => {
          eventsById[event.id] = event
        })
      }
    }

    const houseIds = uniqueIds([
      ...loadedEntries.map((entry) => entry.house_id),
      ...Object.values(eventsById).map((event) => event.house_id),
    ])

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

    const visitCards: VisitEntryCard[] = loadedEntries.map((entry) => ({
      ...entry,
      kind: 'visit',
      sortTime: entry.entry_time,
      visit: entry.visit_id ? visitsById[entry.visit_id] || null : null,
      house: housesById[entry.house_id] || null,
      residential: residentialsById[entry.residential_id] || null,
      guard: guardsById[entry.guard_id] || null,
    }))

    const eventCards: EventEntryCard[] = loadedEventEntries.map((entry) => {
      const event = eventsById[entry.event_id] || null

      return {
        ...entry,
        kind: 'event',
        sortTime: entry.occurred_at,
        event,
        guest: eventGuestsById[entry.event_guest_id] || null,
        house: event?.house_id ? housesById[event.house_id] || null : null,
        residential: residentialsById[entry.residential_id] || null,
        guard: guardsById[entry.guard_id] || null,
      }
    })

    setEntries(
      [...visitCards, ...eventCards]
        .sort(
          (first, second) =>
            new Date(second.sortTime).getTime() -
            new Date(first.sortTime).getTime(),
        )
        .slice(0, 40),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadEntries)
  }, [loadEntries])

  const isAllowed = useMemo(() => canViewEntries(profile), [profile])
  const groupedEntries = useMemo<EntryListItem[]>(() => {
    const items: EntryListItem[] = []
    const eventGroups = new Map<string, EventEntryGroup>()

    entries.forEach((entry) => {
      if (entry.kind === 'visit') {
        items.push(entry)
        return
      }

      const groupId = `event-${entry.event_id}`
      const currentGroup = eventGroups.get(groupId)

      if (!currentGroup) {
        eventGroups.set(groupId, {
          kind: 'event_group',
          id: groupId,
          sortTime: entry.sortTime,
          event: entry.event,
          house: entry.house,
          residential: entry.residential,
          entries: [entry],
          entryCount: entry.action === 'entry' ? 1 : 0,
          exitCount: entry.action === 'exit' ? 1 : 0,
        })
        return
      }

      currentGroup.entries.push(entry)
      currentGroup.entryCount += entry.action === 'entry' ? 1 : 0
      currentGroup.exitCount += entry.action === 'exit' ? 1 : 0

      if (
        new Date(entry.sortTime).getTime() >
        new Date(currentGroup.sortTime).getTime()
      ) {
        currentGroup.sortTime = entry.sortTime
      }
    })

    eventGroups.forEach((group) => {
      group.entries.sort(
        (first, second) =>
          new Date(second.sortTime).getTime() -
          new Date(first.sortTime).getTime(),
      )
      items.push(group)
    })

    return items.sort(
      (first, second) =>
        new Date(second.sortTime).getTime() -
        new Date(first.sortTime).getTime(),
    )
  }, [entries])

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
            {groupedEntries.map((entry) => {
              if (entry.kind === 'event_group') {
                const isExpanded = expandedEventGroupId === entry.id
                const lastActivityDate = new Intl.DateTimeFormat('es-HN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(entry.sortTime))
                const houseLabel = entry.house
                  ? `${entry.house.block}-${entry.house.house_number}`
                  : 'Casa no disponible'

                return (
                  <article
                    key={entry.id}
                    className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedEventGroupId((current) =>
                          current === entry.id ? null : entry.id,
                        )
                      }
                      className="flex min-h-12 w-full items-start justify-between gap-3 text-left transition-all duration-200 ease-out active:scale-[0.98]"
                      aria-expanded={isExpanded}
                    >
                      <span className="min-w-0">
                        <span className="text-sm font-semibold text-[#15936A]">
                          Evento
                        </span>
                        <span className="mt-1 block text-xl font-bold text-slate-950 dark:text-white">
                          {entry.event?.title || 'Evento no disponible'}
                        </span>
                        <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                          {entry.entryCount} ingresos · {entry.exitCount} salidas
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusBadge tone="blue" className="shrink-0">
                          {entry.entries.length}
                        </StatusBadge>
                        <ChevronDown
                          className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                    </button>

                    <div className="mt-4 grid gap-3">
                      <InfoBlock label="Casa" value={houseLabel} />
                      <InfoBlock
                        label="Residencial"
                        value={entry.residential?.name || 'No disponible'}
                      />
                      <InfoBlock
                        label="Ultima actividad"
                        value={lastActivityDate}
                      />
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-2">
                        {entry.entries.map((eventEntry) => {
                          const activityDate = new Intl.DateTimeFormat(
                            'es-HN',
                            {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            },
                          ).format(new Date(eventEntry.occurred_at))

                          return (
                            <div
                              key={eventEntry.id}
                              className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-700/50"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-950 dark:text-white">
                                    {eventEntry.guest?.guest_name ||
                                      'Invitado no disponible'}
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {activityDate}
                                  </p>
                                </div>
                                <StatusBadge
                                  tone={
                                    eventEntry.action === 'entry'
                                      ? 'green'
                                      : 'slate'
                                  }
                                >
                                  {eventEntry.action === 'entry'
                                    ? 'Ingreso'
                                    : 'Salida'}
                                </StatusBadge>
                              </div>
                              <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Guardia:{' '}
                                {eventEntry.guard
                                  ? `${eventEntry.guard.first_name} ${eventEntry.guard.last_name}`
                                  : 'No disponible'}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </article>
                )
              }

              const occurredAt =
                entry.entry_time
              const entryDate = new Intl.DateTimeFormat('es-HN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(occurredAt))
              const exitDate =
                entry.exit_time
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
              const isInside =
                !entry.exit_time && entry.entry_status === 'allowed'
              const exitLabel =
                exitDate || 'Pendiente'
              const title =
                entry.visit?.visitor_name || 'No disponible'
              const typeLabel = 'Visitante'
              const statusLabel =
                isInside ? 'Dentro' : 'Salió'
              const statusTone =
                isInside
                    ? 'green'
                    : 'amber'

              return (
                <article
                  key={entry.id}
                  className="space-y-4 rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {typeLabel}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                        {title}
                      </h2>
                    </div>
                    <StatusBadge
                      tone={statusTone}
                      className="shrink-0"
                    >
                      {statusLabel}
                    </StatusBadge>
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
