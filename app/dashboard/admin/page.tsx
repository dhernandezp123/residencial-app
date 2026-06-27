'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Calendar,
  Clock,
  LogIn,
  LogOut,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type ProfileRole = 'super_admin' | 'admin' | 'resident' | 'guard'
type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'inactive'

type CurrentProfile = {
  id: string
  first_name: string
  last_name: string
  role: ProfileRole
  status: ProfileStatus
  residential_id: string | null
}

type KpiData = {
  visitorsInside: number
  entriesToday: number
  exitsToday: number
  activeVisits: number
  approvedResidents: number
  pendingResidents: number
  securityHouses: number
}

type RecentEntry = {
  id: string
  visitorName: string
  houseLabel: string
  entryTime: string
  isInside: boolean
}

type VisitorEntryRow = {
  id: string
  residential_id: string
  visit_id: string | null
  house_id: string
  entry_status: 'allowed' | 'denied'
  entry_time: string
  exit_time: string | null
}

type VisitRow = { id: string; visitor_name: string }
type HouseRow = { id: string; block: string; house_number: string }

type KpiColor = 'green' | 'blue' | 'orange' | 'violet' | 'emerald' | 'amber' | 'slate'

const colorClasses: Record<
  KpiColor,
  { bg: string; iconBg: string; icon: string; value: string }
> = {
  green: {
    bg: 'bg-white dark:bg-slate-800',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    icon: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
  },
  blue: {
    bg: 'bg-white dark:bg-slate-800',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  orange: {
    bg: 'bg-white dark:bg-slate-800',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    icon: 'text-orange-600 dark:text-orange-400',
    value: 'text-orange-700 dark:text-orange-300',
  },
  violet: {
    bg: 'bg-white dark:bg-slate-800',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    icon: 'text-violet-600 dark:text-violet-400',
    value: 'text-violet-700 dark:text-violet-300',
  },
  emerald: {
    bg: 'bg-white dark:bg-slate-800',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    bg: 'bg-white dark:bg-slate-800',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
  },
  slate: {
    bg: 'bg-white dark:bg-slate-800',
    iconBg: 'bg-slate-100 dark:bg-slate-700',
    icon: 'text-slate-600 dark:text-slate-300',
    value: 'text-slate-700 dark:text-slate-200',
  },
}

export default function AdminDashboardPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesión para continuar')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,role,status,residential_id')
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
      !['admin', 'super_admin'].includes(currentProfile.role) ||
      currentProfile.status !== 'approved'
    ) {
      setLoading(false)
      return
    }

    if (currentProfile.role === 'admin' && !currentProfile.residential_id) {
      toast.error('Tu perfil no tiene residencial asignado')
      setLoading(false)
      return
    }

    const isSuperAdmin = currentProfile.role === 'super_admin'
    const rid = currentProfile.residential_id

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayISO = todayStart.toISOString()

    const [
      insideResult,
      entriesTodayResult,
      exitsTodayResult,
      activeVisitsResult,
      approvedResult,
      pendingResult,
      securityResult,
    ] = await Promise.all([
      (() => {
        let q = supabase
          .from('visitor_entries')
          .select('id', { count: 'exact', head: true })
          .is('exit_time', null)
          .eq('entry_status', 'allowed')
        if (!isSuperAdmin && rid) q = q.eq('residential_id', rid)
        return q
      })(),
      (() => {
        let q = supabase
          .from('visitor_entries')
          .select('id', { count: 'exact', head: true })
          .gte('entry_time', todayISO)
        if (!isSuperAdmin && rid) q = q.eq('residential_id', rid)
        return q
      })(),
      (() => {
        let q = supabase
          .from('visitor_entries')
          .select('id', { count: 'exact', head: true })
          .gte('exit_time', todayISO)
        if (!isSuperAdmin && rid) q = q.eq('residential_id', rid)
        return q
      })(),
      (() => {
        let q = supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
        if (!isSuperAdmin && rid) q = q.eq('residential_id', rid)
        return q
      })(),
      (() => {
        let q = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'resident')
          .eq('status', 'approved')
        if (!isSuperAdmin && rid) q = q.eq('residential_id', rid)
        return q
      })(),
      (() => {
        let q = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'resident')
          .eq('status', 'pending')
        if (!isSuperAdmin && rid) q = q.eq('residential_id', rid)
        return q
      })(),
      (() => {
        let q = supabase
          .from('houses')
          .select('id', { count: 'exact', head: true })
          .eq('pays_security', true)
        if (!isSuperAdmin && rid) q = q.eq('residential_id', rid)
        return q
      })(),
    ])

    const kpiErrors = [
      insideResult.error,
      entriesTodayResult.error,
      exitsTodayResult.error,
      activeVisitsResult.error,
      approvedResult.error,
      pendingResult.error,
      securityResult.error,
    ].filter(Boolean)

    if (kpiErrors.length > 0) {
      console.error('KPI query errors:', kpiErrors)
      toast.error('Algunos indicadores no pudieron cargarse')
    }

    setKpis({
      visitorsInside: insideResult.count ?? 0,
      entriesToday: entriesTodayResult.count ?? 0,
      exitsToday: exitsTodayResult.count ?? 0,
      activeVisits: activeVisitsResult.count ?? 0,
      approvedResidents: approvedResult.count ?? 0,
      pendingResidents: pendingResult.count ?? 0,
      securityHouses: securityResult.count ?? 0,
    })

    let recentQuery = supabase
      .from('visitor_entries')
      .select('id,residential_id,visit_id,house_id,entry_status,entry_time,exit_time')
      .order('entry_time', { ascending: false })
      .limit(8)

    if (!isSuperAdmin && rid) {
      recentQuery = recentQuery.eq('residential_id', rid)
    }

    const { data: entriesData, error: entriesError } = await recentQuery

    if (entriesError) {
      console.error('Error loading recent entries:', entriesError)
      toast.error('No se pudieron cargar los últimos ingresos')
      setLoading(false)
      return
    }

    const loadedEntries = (entriesData ?? []) as VisitorEntryRow[]

    const visitIds = Array.from(
      new Set(
        loadedEntries
          .map((e) => e.visit_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )
    const houseIds = Array.from(
      new Set(loadedEntries.map((e) => e.house_id).filter(Boolean)),
    )

    const [visitsResult, housesResult] = await Promise.all([
      visitIds.length > 0
        ? supabase.from('visits').select('id,visitor_name').in('id', visitIds)
        : Promise.resolve({ data: [] as VisitRow[], error: null }),
      houseIds.length > 0
        ? supabase
            .from('houses')
            .select('id,block,house_number')
            .in('id', houseIds)
        : Promise.resolve({ data: [] as HouseRow[], error: null }),
    ])

    const visitsById = new Map(
      ((visitsResult.data ?? []) as VisitRow[]).map((v) => [v.id, v]),
    )
    const housesById = new Map(
      ((housesResult.data ?? []) as HouseRow[]).map((h) => [h.id, h]),
    )

    setRecentEntries(
      loadedEntries.map((entry) => {
        const visit = entry.visit_id ? visitsById.get(entry.visit_id) : undefined
        const house = housesById.get(entry.house_id)
        return {
          id: entry.id,
          visitorName: visit?.visitor_name ?? 'Visitante desconocido',
          houseLabel: house
            ? `${house.block}-${house.house_number}`
            : 'Casa no disponible',
          entryTime: entry.entry_time,
          isInside: !entry.exit_time && entry.entry_status === 'allowed',
        }
      }),
    )

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (
    !profile ||
    !['admin', 'super_admin'].includes(profile.role) ||
    profile.status !== 'approved'
  ) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Acceso restringido
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Solo administradores y super administradores aprobados pueden ver
            este dashboard.
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
          <p className="text-sm text-slate-300">
            {profile.role === 'super_admin' ? 'Vista global' : 'Administración'}
          </p>
          <h1 className="mt-1 text-2xl font-bold">Dashboard</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Resumen operativo{' '}
            {profile.role === 'super_admin'
              ? 'de todos los residenciales'
              : 'del residencial'}
            .
          </p>
        </header>

        {kpis !== null && (
          <section className="grid grid-cols-2 gap-3">
            <KpiCard
              icon={Users}
              label="Dentro ahora"
              value={kpis.visitorsInside}
              color="green"
            />
            <KpiCard
              icon={LogIn}
              label="Ingresos hoy"
              value={kpis.entriesToday}
              color="blue"
            />
            <KpiCard
              icon={LogOut}
              label="Salidas hoy"
              value={kpis.exitsToday}
              color="orange"
            />
            <KpiCard
              icon={Calendar}
              label="Visitas activas"
              value={kpis.activeVisits}
              color="violet"
            />
            <KpiCard
              icon={UserCheck}
              label="Residentes aprobados"
              value={kpis.approvedResidents}
              color="emerald"
            />
            <KpiCard
              icon={Clock}
              label="Residentes pendientes"
              value={kpis.pendingResidents}
              color="amber"
            />
            <KpiCard
              icon={Shield}
              label="Casas con seguridad activa"
              value={kpis.securityHouses}
              color="slate"
              wide
            />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Últimos ingresos
          </h2>

          {recentEntries.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 text-sm text-slate-500 dark:text-slate-400 shadow-sm">
              No hay ingresos registrados aún.
            </div>
          ) : (
            recentEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))
          )}
        </section>
      </div>
    </main>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  wide = false,
}: {
  icon: LucideIcon
  label: string
  value: number
  color: KpiColor
  wide?: boolean
}) {
  const c = colorClasses[color]
  return (
    <article
      className={`rounded-2xl p-4 shadow-sm ${c.bg} ${wide ? 'col-span-2' : ''}`}
    >
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${c.iconBg}`}
      >
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </span>
      <p className={`mt-3 text-3xl font-bold ${c.value}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </article>
  )
}

function EntryCard({ entry }: { entry: RecentEntry }) {
  const formattedTime = new Intl.DateTimeFormat('es-HN', {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(entry.entryTime))

  return (
    <article className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-white">
            {entry.visitorName}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Casa {entry.houseLabel} · {formattedTime}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            entry.isInside
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {entry.isInside ? 'Dentro' : 'Salió'}
        </span>
      </div>
    </article>
  )
}

function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <div className="h-4 w-32 animate-pulse rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-300 dark:bg-slate-600" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700"
            />
          ))}
          <div className="col-span-2 h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-300 dark:bg-slate-600" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700"
          />
        ))}
      </div>
    </main>
  )
}
