'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  first_name: string
  last_name: string
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
  user_id: string
}

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        window.location.href = '/login'
        return
      }

      console.log('AUTH USER ID:', sessionData.session.user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('first_name,last_name,role,status,user_id')
        .eq('user_id', sessionData.session.user.id)
        .single()

      console.log('PROFILE DATA:', data)
      console.log('PROFILE ERROR:', error)

      setProfile(data)
      setLoading(false)
    }

    loadProfile()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Cargando...
      </main>
    )
  }

  if (!profile || profile.status !== 'approved') {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow">
          <h1 className="text-xl font-bold text-slate-900">Acceso pendiente</h1>
          <p className="mt-2 text-sm text-slate-500">
            Tu usuario aún no ha sido aprobado por administración.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Bienvenido</p>
          <h1 className="mt-1 text-2xl font-bold">
            {profile.first_name} {profile.last_name}
          </h1>
          <p className="mt-2 text-sm capitalize text-slate-300">
            {profile.role.replace('_', ' ')}
          </p>
        </div>

        {profile.role === 'super_admin' && <SuperAdminDashboard />}
        {profile.role === 'admin' && <AdminDashboard />}
        {profile.role === 'resident' && <ResidentDashboard />}
        {profile.role === 'guard' && <GuardDashboard />}

        <button
          onClick={handleLogout}
          className="w-full rounded-2xl bg-red-600 py-3 font-semibold text-white"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}

function SuperAdminDashboard() {
  return (
    <div className="grid gap-3">
      <DashboardButton
        title="Residenciales"
        subtitle="Crear y administrar residenciales"
        href="/dashboard/residentials"
      />
      <DashboardButton title="Administradores" subtitle="Asignar admins por residencial" />
      <DashboardButton title="Estado SaaS" subtitle="Ver residenciales activos e inactivos" />
    </div>
  )
}

function AdminDashboard() {
  return (
    <div className="grid gap-3">
      <DashboardButton title="Casas" subtitle="Registrar lotes y casas" />
      <DashboardButton
        title="Residentes pendientes"
        subtitle="Aprobar vecinos"
        href="/dashboard/residents"
      />
      <DashboardButton title="Guardias" subtitle="Crear usuarios de seguridad" />
    </div>
  )
}

function ResidentDashboard() {
  return (
    <div className="grid gap-3">
      <DashboardButton
        title="Nueva visita"
        subtitle="Generar QR para visitante"
        href="/dashboard/visits/new"
      />
      <DashboardButton
        title="Mis visitas"
        subtitle="Ver visitas activas e historial"
        href="/dashboard/visits"
      />
      <DashboardButton
        title="Mi casa"
        subtitle="Ver datos de mi vivienda"
        href="/dashboard/my-house"
      />
    </div>
  )
}

function GuardDashboard() {
  return (
    <div className="grid gap-3">
      <DashboardButton title="Escanear QR" subtitle="Validar acceso de visitantes" />
      <DashboardButton title="Entradas recientes" subtitle="Ver ingresos registrados" />
    </div>
  )
}

function DashboardButton({
  title,
  subtitle,
  href,
}: {
  title: string
  subtitle: string
  href?: string
}) {
  const content = (
    <>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-2xl bg-white p-5 text-left shadow-sm active:scale-[0.99]"
      >
        {content}
      </Link>
    )
  }

  return (
    <button className="rounded-2xl bg-white p-5 text-left shadow-sm active:scale-[0.99]">
      {content}
    </button>
  )
}
