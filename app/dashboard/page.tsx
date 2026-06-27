'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  Bell,
  Camera,
  ClipboardList,
  Home,
  Plus,
  Shield,
  Building2,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Profile = {
  first_name: string
  last_name: string
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
  user_id: string
}

const roleLabels: Record<Profile['role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  resident: 'Residente',
  guard: 'Guardia',
}

const roleBadgeClass: Record<Profile['role'], string> = {
  super_admin: 'bg-violet-500/20 text-violet-300',
  admin: 'bg-blue-500/20 text-blue-300',
  resident: 'bg-emerald-500/20 text-emerald-300',
  guard: 'bg-amber-500/20 text-amber-300',
}

export default function HomePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('first_name,last_name,role,status,user_id')
        .eq('user_id', sessionData.session.user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }

    loadProfile()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-300 dark:bg-slate-600" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </main>
    )
  }

  if (!profile || profile.status !== 'approved') {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6 flex items-center justify-center">
        <div className="mx-auto max-w-sm w-full rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-2xl">
            ⏳
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Acceso pendiente</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Tu usuario aún no ha sido aprobado por administración.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 py-3 font-semibold text-white active:scale-[0.99]"
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-3">

        {/* Profile card */}
        <div className="rounded-2xl bg-slate-950 dark:bg-slate-800 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Bienvenido
              </p>
              <h1 className="mt-1 text-xl font-bold leading-tight truncate">
                {profile.first_name} {profile.last_name}
              </h1>
              <span
                className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass[profile.role]}`}
              >
                {roleLabels[profile.role]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex-shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/20 active:scale-[0.97] transition-colors"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Role dashboards */}
        {profile.role === 'super_admin' && <SuperAdminDashboard />}
        {profile.role === 'admin' && <AdminDashboard />}
        {profile.role === 'resident' && <ResidentDashboard />}
        {profile.role === 'guard' && <GuardDashboard />}

      </div>
    </main>
  )
}

function SuperAdminDashboard() {
  return (
    <div className="space-y-3">
      <DashboardButton
        icon={BarChart3}
        title="Dashboard administración"
        subtitle="KPIs y resumen global del sistema"
        href="/dashboard/admin"
      />
      <DashboardButton
        icon={Building2}
        title="Residenciales"
        subtitle="Crear y administrar residenciales"
        href="/dashboard/residentials"
      />
      <DashboardButton
        icon={UserCog}
        title="Administradores"
        subtitle="Asignar admins por residencial"
        comingSoon
      />
    </div>
  )
}

function AdminDashboard() {
  return (
    <div className="space-y-3">
      <DashboardButton
        icon={BarChart3}
        title="Dashboard administración"
        subtitle="KPIs y resumen del residencial"
        href="/dashboard/admin"
      />
      <DashboardButton
        icon={Home}
        title="Casas"
        subtitle="Registrar lotes y casas"
        href="/dashboard/houses"
      />
      <DashboardButton
        icon={UserCheck}
        title="Residentes pendientes"
        subtitle="Aprobar vecinos"
        href="/dashboard/residents"
      />
      <DashboardButton
        icon={Shield}
        title="Guardias"
        subtitle="Crear usuarios de seguridad"
        href="/dashboard/guards"
      />
    </div>
  )
}

function ResidentDashboard() {
  return (
    <div className="space-y-3">
      <DashboardButton
        icon={Plus}
        title="Nueva visita"
        subtitle="Generar QR para visitante"
        href="/dashboard/visits/new"
        highlight
      />
      <DashboardButton
        icon={ClipboardList}
        title="Mis visitas"
        subtitle="Ver visitas activas e historial"
        href="/dashboard/visits"
      />
      <DashboardButton
        icon={Home}
        title="Mi casa"
        subtitle="Ver datos de mi vivienda"
        href="/dashboard/my-house"
      />
      <DashboardButton
        icon={Bell}
        title="Notificaciones"
        subtitle="Ver avisos de entradas y salidas"
        href="/dashboard/notifications"
      />
    </div>
  )
}

function GuardDashboard() {
  return (
    <div className="space-y-3">
      <DashboardButton
        icon={Camera}
        title="Escanear QR"
        subtitle="Validar acceso de visitantes"
        href="/gate/scan"
        highlight
      />
      <DashboardButton
        icon={ClipboardList}
        title="Entradas recientes"
        subtitle="Ver ingresos registrados"
        href="/dashboard/entries"
      />
      <DashboardButton
        icon={Users}
        title="Personas dentro"
        subtitle="Ver visitantes actualmente dentro"
        href="/dashboard/inside"
      />
    </div>
  )
}

function DashboardButton({
  icon: Icon,
  title,
  subtitle,
  href,
  highlight,
  comingSoon,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  href?: string
  highlight?: boolean
  comingSoon?: boolean
}) {
  const content = (
    <div className="flex items-center gap-4">
      <span className={`flex-shrink-0 rounded-xl p-2 ${comingSoon ? 'bg-slate-300 dark:bg-slate-600 text-slate-400' : highlight ? 'bg-white/15 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className={`font-semibold leading-tight ${comingSoon ? 'text-slate-400 dark:text-slate-500' : highlight ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
          {title}
        </p>
        <p className={`mt-0.5 text-sm ${comingSoon ? 'text-slate-400 dark:text-slate-500' : highlight ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
          {subtitle}
        </p>
      </div>
      {comingSoon ? (
        <span className="flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-600 px-2 py-0.5 text-xs font-semibold text-slate-400 dark:text-slate-300">
          Pronto
        </span>
      ) : (
        <span className={`flex-shrink-0 text-lg ${highlight ? 'text-white/60' : 'text-slate-300 dark:text-slate-500'}`}>›</span>
      )}
    </div>
  )

  const baseClass = `block w-full rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-transform min-h-[4.5rem] ${
    comingSoon
      ? 'bg-slate-200 dark:bg-slate-700 cursor-default opacity-60'
      : highlight
        ? 'bg-slate-950 dark:bg-slate-700'
        : 'bg-white dark:bg-slate-800'
  }`

  if (href && !comingSoon) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    )
  }

  return (
    <div className={baseClass}>
      {content}
    </div>
  )
}