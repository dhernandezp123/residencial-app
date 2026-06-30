'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Home,
  HousePlus,
  ReceiptText,
  ShieldPlus,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { ActivityTimeline } from './ActivityTimeline'
import type { ActivityItem, ActivityKind } from './ActivityTimeline'
import { AdminStatCard } from './AdminStatCard'
import { QuickActionCard } from './QuickActionCard'
import { LoadingSkeleton, SectionHeader } from '@/components/ui'

type ProfileRole = 'super_admin' | 'admin' | 'resident' | 'guard'
type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'inactive'

type CurrentProfile = {
  id: string
  first_name: string
  last_name: string
  role: ProfileRole
  status: ProfileStatus
  residential_id: string | null
  is_residential_admin: boolean | null
}

type AdminKpis = {
  houses: number
  activeHouses: number
  approvedResidents: number
  pendingResidents: number
  activeVisits: number
  peopleInside: number
  activeEvents: number
  pendingReceipts: number
}

type VisitorEntryRow = {
  id: string
  visit_id: string | null
  house_id: string
  entry_status: 'allowed' | 'denied'
  entry_time: string
  exit_time: string | null
  updated_at: string
}

type VisitRow = {
  id: string
  visitor_name: string
  visit_type: 'family' | 'delivery' | 'service' | 'provider' | 'other'
}

type HouseRow = {
  id: string
  block: string
  house_number: string
}

type EventGuestEntryRow = {
  id: string
  event_id: string
  event_guest_id: string
  action: 'entry' | 'exit' | string
  occurred_at: string
}

type EventRow = {
  id: string
  title: string
}

type EventGuestRow = {
  id: string
  guest_name: string
}

type ResidentActivityRow = {
  id: string
  first_name: string
  last_name: string
  status: ProfileStatus
  created_at: string
  updated_at: string
  house_id: string | null
}

const residentPassGreen = '#15936A'

function isAdminProfile(profile: CurrentProfile): boolean {
  return (
    profile.status === 'approved' &&
    (profile.role === 'super_admin' ||
      profile.role === 'admin' ||
      Boolean(profile.is_residential_admin))
  )
}

function getHouseLabel(house: HouseRow | undefined): string {
  return house ? `Casa ${house.block}-${house.house_number}` : 'Casa no disponible'
}

function getFullName(profile: ResidentActivityRow): string {
  return `${profile.first_name} ${profile.last_name}`.trim() || 'Residente'
}

function byNewestActivity(a: ActivityItem, b: ActivityItem): number {
  return (
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  )
}

export default function AdminDashboardPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [kpis, setKpis] = useState<AdminKpis | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const isSuperAdmin = profile?.role === 'super_admin'
  const scopeLabel = useMemo(() => {
    if (!profile) return 'Administracion'
    return isSuperAdmin ? 'Vista global' : 'Panel administrativo'
  }, [isSuperAdmin, profile])

  const loadData = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesion para continuar')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,role,status,residential_id,is_residential_admin')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError || !profileData) {
      console.error('Error loading admin profile:', profileError)
      toast.error('No se pudo cargar tu perfil')
      setLoading(false)
      return
    }

    const currentProfile = profileData as CurrentProfile
    setProfile(currentProfile)

    if (!isAdminProfile(currentProfile)) {
      setLoading(false)
      return
    }

    const isGlobal = currentProfile.role === 'super_admin'
    const residentialId = currentProfile.residential_id

    if (!isGlobal && !residentialId) {
      toast.error('Tu perfil no tiene residencial asignado')
      setLoading(false)
      return
    }

    const nowIso = new Date().toISOString()

    const [
      housesResult,
      activeHousesResult,
      approvedResidentsResult,
      pendingResidentsResult,
      activeVisitsResult,
      peopleInsideResult,
      activeEventsResult,
    ] = await Promise.all([
      (() => {
        let query = supabase
          .from('houses')
          .select('id', { count: 'exact', head: true })
        if (!isGlobal && residentialId) {
          query = query.eq('residential_id', residentialId)
        }
        return query
      })(),
      (() => {
        let query = supabase
          .from('houses')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
        if (!isGlobal && residentialId) {
          query = query.eq('residential_id', residentialId)
        }
        return query
      })(),
      (() => {
        let query = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'resident')
          .eq('status', 'approved')
        if (!isGlobal && residentialId) {
          query = query.eq('residential_id', residentialId)
        }
        return query
      })(),
      (() => {
        let query = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'resident')
          .eq('status', 'pending')
        if (!isGlobal && residentialId) {
          query = query.eq('residential_id', residentialId)
        }
        return query
      })(),
      (() => {
        let query = supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .gt('valid_until', nowIso)
        if (!isGlobal && residentialId) {
          query = query.eq('residential_id', residentialId)
        }
        return query
      })(),
      (() => {
        let query = supabase
          .from('visitor_entries')
          .select('id', { count: 'exact', head: true })
          .eq('entry_status', 'allowed')
          .is('exit_time', null)
        if (!isGlobal && residentialId) {
          query = query.eq('residential_id', residentialId)
        }
        return query
      })(),
      (() => {
        let query = supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .gt('valid_until', nowIso)
        if (!isGlobal && residentialId) {
          query = query.eq('residential_id', residentialId)
        }
        return query
      })(),
    ])

    const kpiErrors = [
      housesResult.error,
      activeHousesResult.error,
      approvedResidentsResult.error,
      pendingResidentsResult.error,
      activeVisitsResult.error,
      peopleInsideResult.error,
      activeEventsResult.error,
    ].filter(Boolean)

    if (kpiErrors.length > 0) {
      console.error('Admin KPI errors:', kpiErrors)
      toast.error('Algunos indicadores no pudieron cargarse')
    }

    setKpis({
      houses: housesResult.count ?? 0,
      activeHouses: activeHousesResult.count ?? 0,
      approvedResidents: approvedResidentsResult.count ?? 0,
      pendingResidents: pendingResidentsResult.count ?? 0,
      activeVisits: activeVisitsResult.count ?? 0,
      peopleInside: peopleInsideResult.count ?? 0,
      activeEvents: activeEventsResult.count ?? 0,
      pendingReceipts: 0,
    })

    const nextActivities = await loadActivities(isGlobal, residentialId)
    setActivities(nextActivities)
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!profile || !isAdminProfile(profile)) {
    return (
      <main className="min-h-screen bg-[#F3F8F5] px-5 py-6 dark:bg-slate-950">
        <div className="mx-auto max-w-md rounded-3xl border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/85">
          <h1 className="text-xl font-black text-slate-950 dark:text-white">
            Acceso restringido
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Solo administradores aprobados pueden ver este dashboard.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] dark:bg-slate-700"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F3F8F5] px-4 py-5 dark:bg-slate-950 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center rounded-full px-1 text-sm font-bold text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          Volver al dashboard
        </Link>

        <header className="overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl shadow-slate-300/60 dark:bg-slate-900 dark:shadow-black/30 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold" style={{ color: residentPassGreen }}>
                ResidentPass
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Dashboard administrativo
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                {scopeLabel} para revisar operacion, accesos y solicitudes en menos de 5 segundos.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Administrador
              </p>
              <p className="mt-1 text-sm font-bold">
                {profile.first_name} {profile.last_name}
              </p>
            </div>
          </div>
        </header>

        {kpis && (
          <section aria-labelledby="kpis-title" className="space-y-3">
            <SectionHeader
              id="kpis-title"
              title="Estado general"
              subtitle="Indicadores clave del residencial."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <AdminStatCard icon={Home} label="Casas" value={kpis.houses} />
              <AdminStatCard
                icon={ClipboardCheck}
                label="Casas activas"
                value={kpis.activeHouses}
              />
              <AdminStatCard
                icon={UserCheck}
                label="Residentes aprobados"
                value={kpis.approvedResidents}
                tone="blue"
              />
              <AdminStatCard
                icon={UserPlus}
                label="Residentes pendientes"
                value={kpis.pendingResidents}
                tone={kpis.pendingResidents > 0 ? 'amber' : 'slate'}
              />
              <AdminStatCard
                icon={Users}
                label="Visitas activas"
                value={kpis.activeVisits}
              />
              <AdminStatCard
                icon={ShieldPlus}
                label="Personas dentro"
                value={kpis.peopleInside}
                tone={kpis.peopleInside > 0 ? 'green' : 'slate'}
              />
              <AdminStatCard
                icon={CalendarDays}
                label="Eventos activos"
                value={kpis.activeEvents}
                tone="blue"
              />
              <AdminStatCard
                icon={ReceiptText}
                label="Comprobantes pendientes"
                value={kpis.pendingReceipts}
                helper="Modulo pendiente"
                tone="slate"
              />
            </div>
          </section>
        )}

        <section aria-labelledby="quick-actions-title" className="space-y-3">
          <SectionHeader
            id="quick-actions-title"
            title="Acciones rapidas"
            subtitle="Atajos operativos para tareas frecuentes."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickActionCard
              href="/dashboard/residents"
              icon={UserCheck}
              title="Aprobar residentes"
              subtitle="Revisar solicitudes pendientes"
            />
            <QuickActionCard
              href="/dashboard/guards"
              icon={ShieldPlus}
              title="Registrar guardia"
              subtitle="Crear o administrar seguridad"
            />
            <QuickActionCard
              href="/dashboard/houses"
              icon={HousePlus}
              title="Crear casa"
              subtitle="Gestionar viviendas"
            />
            <QuickActionCard
              href="/dashboard/reports"
              icon={BarChart3}
              title="Ver reportes"
              subtitle="Incidencias y seguimiento"
            />
          </div>
        </section>

        <section aria-labelledby="activity-title" className="space-y-3 pb-6">
          <SectionHeader
            id="activity-title"
            title="Actividad reciente"
            subtitle="Ultimos 20 movimientos del residencial."
          />
          <ActivityTimeline items={activities} />
        </section>
      </div>
    </main>
  )
}

async function loadActivities(
  isGlobal: boolean,
  residentialId: string | null,
): Promise<ActivityItem[]> {
  const [visitorActivities, eventActivities, residentActivities] =
    await Promise.all([
      loadVisitorActivities(isGlobal, residentialId),
      loadEventActivities(isGlobal, residentialId),
      loadResidentActivities(isGlobal, residentialId),
    ])

  return [...visitorActivities, ...eventActivities, ...residentActivities]
    .sort(byNewestActivity)
    .slice(0, 20)
}

async function loadVisitorActivities(
  isGlobal: boolean,
  residentialId: string | null,
): Promise<ActivityItem[]> {
  let entriesQuery = supabase
    .from('visitor_entries')
    .select('id,visit_id,house_id,entry_status,entry_time,exit_time,updated_at')
    .order('updated_at', { ascending: false })
    .limit(24)

  if (!isGlobal && residentialId) {
    entriesQuery = entriesQuery.eq('residential_id', residentialId)
  }

  const { data: entriesData, error: entriesError } = await entriesQuery

  if (entriesError) {
    console.error('Error loading visitor activities:', entriesError)
    return []
  }

  const entries = (entriesData ?? []) as VisitorEntryRow[]
  const visitIds = Array.from(
    new Set(
      entries
        .map((entry) => entry.visit_id)
        .filter((visitId): visitId is string => Boolean(visitId)),
    ),
  )
  const houseIds = Array.from(new Set(entries.map((entry) => entry.house_id)))

  const [visitsResult, housesResult] = await Promise.all([
    visitIds.length > 0
      ? supabase
          .from('visits')
          .select('id,visitor_name,visit_type')
          .in('id', visitIds)
      : Promise.resolve({ data: [] as VisitRow[], error: null }),
    houseIds.length > 0
      ? supabase
          .from('houses')
          .select('id,block,house_number')
          .in('id', houseIds)
      : Promise.resolve({ data: [] as HouseRow[], error: null }),
  ])

  if (visitsResult.error || housesResult.error) {
    console.error('Error enriching visitor activities:', {
      visitsError: visitsResult.error,
      housesError: housesResult.error,
    })
  }

  const visitsById = new Map(
    ((visitsResult.data ?? []) as VisitRow[]).map((visit) => [visit.id, visit]),
  )
  const housesById = new Map(
    ((housesResult.data ?? []) as HouseRow[]).map((house) => [house.id, house]),
  )

  return entries.flatMap((entry) => {
    const visit = entry.visit_id ? visitsById.get(entry.visit_id) : undefined
    const houseLabel = getHouseLabel(housesById.get(entry.house_id))
    const visitorName = visit?.visitor_name ?? 'Visitante'
    const isDelivery = visit?.visit_type === 'delivery'
    const items: ActivityItem[] = []

    if (entry.entry_status === 'allowed') {
      items.push({
        id: `${entry.id}-entry`,
        kind: isDelivery ? 'delivery' : 'visit_entry',
        title: isDelivery ? 'Delivery registrado' : 'Ingreso registrado',
        description: `${visitorName} - ${houseLabel}`,
        occurredAt: entry.entry_time,
      })
    }

    if (entry.exit_time) {
      items.push({
        id: `${entry.id}-exit`,
        kind: isDelivery ? 'delivery' : 'visit_exit',
        title: isDelivery ? 'Delivery finalizado' : 'Salida registrada',
        description: `${visitorName} - ${houseLabel}`,
        occurredAt: entry.exit_time,
      })
    }

    return items
  })
}

async function loadEventActivities(
  isGlobal: boolean,
  residentialId: string | null,
): Promise<ActivityItem[]> {
  let eventEntriesQuery = supabase
    .from('event_guest_entries')
    .select('id,event_id,event_guest_id,action,occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(20)

  if (!isGlobal && residentialId) {
    eventEntriesQuery = eventEntriesQuery.eq('residential_id', residentialId)
  }

  const { data: entriesData, error: entriesError } = await eventEntriesQuery

  if (entriesError) {
    console.error('Error loading event activities:', entriesError)
    return []
  }

  const entries = (entriesData ?? []) as EventGuestEntryRow[]
  const eventIds = Array.from(new Set(entries.map((entry) => entry.event_id)))
  const guestIds = Array.from(
    new Set(entries.map((entry) => entry.event_guest_id)),
  )

  const [eventsResult, guestsResult] = await Promise.all([
    eventIds.length > 0
      ? supabase.from('events').select('id,title').in('id', eventIds)
      : Promise.resolve({ data: [] as EventRow[], error: null }),
    guestIds.length > 0
      ? supabase.from('event_guests').select('id,guest_name').in('id', guestIds)
      : Promise.resolve({ data: [] as EventGuestRow[], error: null }),
  ])

  if (eventsResult.error || guestsResult.error) {
    console.error('Error enriching event activities:', {
      eventsError: eventsResult.error,
      guestsError: guestsResult.error,
    })
  }

  const eventsById = new Map(
    ((eventsResult.data ?? []) as EventRow[]).map((event) => [event.id, event]),
  )
  const guestsById = new Map(
    ((guestsResult.data ?? []) as EventGuestRow[]).map((guest) => [
      guest.id,
      guest,
    ]),
  )

  return entries.map((entry) => {
    const event = eventsById.get(entry.event_id)
    const guest = guestsById.get(entry.event_guest_id)
    const action = entry.action === 'exit' ? 'salio del evento' : 'ingreso al evento'

    return {
      id: `event-${entry.id}`,
      kind: 'event',
      title: event?.title ?? 'Evento',
      description: `${guest?.guest_name ?? 'Invitado'} ${action}`,
      occurredAt: entry.occurred_at,
    }
  })
}

async function loadResidentActivities(
  isGlobal: boolean,
  residentialId: string | null,
): Promise<ActivityItem[]> {
  let residentsQuery = supabase
    .from('profiles')
    .select('id,first_name,last_name,status,created_at,updated_at,house_id')
    .eq('role', 'resident')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (!isGlobal && residentialId) {
    residentsQuery = residentsQuery.eq('residential_id', residentialId)
  }

  const { data: residentsData, error: residentsError } = await residentsQuery

  if (residentsError) {
    console.error('Error loading resident activities:', residentsError)
    return []
  }

  const residents = (residentsData ?? []) as ResidentActivityRow[]
  const houseIds = Array.from(
    new Set(
      residents
        .map((resident) => resident.house_id)
        .filter((houseId): houseId is string => Boolean(houseId)),
    ),
  )

  const { data: housesData, error: housesError } =
    houseIds.length > 0
      ? await supabase
          .from('houses')
          .select('id,block,house_number')
          .in('id', houseIds)
      : { data: [] as HouseRow[], error: null }

  if (housesError) {
    console.error('Error enriching resident activities:', housesError)
  }

  const housesById = new Map(
    ((housesData ?? []) as HouseRow[]).map((house) => [house.id, house]),
  )

  return residents.flatMap((resident) => {
    const houseLabel = resident.house_id
      ? getHouseLabel(housesById.get(resident.house_id))
      : 'Casa pendiente'
    const name = getFullName(resident)
    const activities: ActivityItem[] = [
      {
        id: `resident-registration-${resident.id}`,
        kind: 'resident_registration' as ActivityKind,
        title: 'Nuevo registro de residente',
        description: `${name} - ${houseLabel}`,
        occurredAt: resident.created_at,
      },
    ]

    if (resident.status === 'approved' && resident.updated_at !== resident.created_at) {
      activities.push({
        id: `resident-approval-${resident.id}`,
        kind: 'resident_approval',
        title: 'Residente aprobado',
        description: `${name} - ${houseLabel}`,
        occurredAt: resident.updated_at,
      })
    }

    return activities
  })
}

function DashboardSkeleton() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F3F8F5] px-4 py-5 dark:bg-slate-950 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <LoadingSkeleton className="h-11 w-36 animate-pulse rounded-full bg-white/80 dark:bg-slate-800" />
        <LoadingSkeleton className="h-48 animate-pulse rounded-[2rem] bg-slate-900/90 dark:bg-slate-800" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <LoadingSkeleton
              key={index}
              className="h-32 animate-pulse rounded-3xl bg-white/80 dark:bg-slate-800"
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton
              key={index}
              className="h-24 animate-pulse rounded-3xl bg-white/80 dark:bg-slate-800"
            />
          ))}
        </div>
        <LoadingSkeleton className="h-80 animate-pulse rounded-3xl bg-white/80 dark:bg-slate-800" />
      </div>
    </main>
  )
}
