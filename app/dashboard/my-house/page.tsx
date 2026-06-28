'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  first_name: string
  last_name: string
  residential_id: string | null
  house_id: string | null
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
}

type House = {
  id: string
  residential_id: string
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: number | null
}

type Residential = {
  id: string
  name: string
}

type ApprovedResident = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
}

export default function MyHousePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [house, setHouse] = useState<House | null>(null)
  const [residential, setResidential] = useState<Residential | null>(null)
  const [approvedResidents, setApprovedResidents] = useState<
    ApprovedResident[]
  >([])
  const [activeVisitsCount, setActiveVisitsCount] = useState(0)
  const [monthlyVisitsCount, setMonthlyVisitsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadMyHouse = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesión para ver tu casa')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,residential_id,house_id,role,status')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError) {
      console.error('Error loading profile:', profileError)
      toast.error('No se pudo cargar tu perfil')
      setLoading(false)
      return
    }

    setProfile(profileData)

    if (
      profileData.role !== 'resident' ||
      profileData.status !== 'approved' ||
      !profileData.house_id
    ) {
      setLoading(false)
      return
    }

    const { data: houseData, error: houseError } = await supabase
      .from('houses')
      .select('id,residential_id,block,house_number,pays_security,resident_limit')
      .eq('id', profileData.house_id)
      .single()

    if (houseError) {
      console.error('Error loading house:', houseError)
      toast.error('No se pudo cargar tu casa')
      setLoading(false)
      return
    }

    setHouse(houseData)

    const { data: residentialData, error: residentialError } = await supabase
      .from('residentials')
      .select('id,name')
      .eq('id', houseData.residential_id)
      .single()

    if (residentialError) {
      console.error('Error loading residential:', residentialError)
      toast.error('No se pudo cargar el residencial')
    } else {
      setResidential(residentialData)
    }

    const { data: residentsData, error: residentsError } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,phone')
      .eq('house_id', houseData.id)
      .eq('role', 'resident')
      .eq('status', 'approved')
      .order('first_name', { ascending: true })

    if (residentsError) {
      console.error('Error loading approved residents:', residentsError)
      toast.error('No se pudieron cargar los residentes aprobados')
    } else {
      setApprovedResidents(residentsData || [])
    }

    const now = new Date()
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString()
    const startOfNextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
    ).toISOString()

    const { count: activeCount, error: activeVisitsError } = await supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('house_id', houseData.id)
      .eq('status', 'active')
      .gt('valid_until', now.toISOString())

    if (activeVisitsError) {
      console.error('Error loading active visits count:', activeVisitsError)
      toast.error('No se pudieron cargar las visitas activas')
    } else {
      setActiveVisitsCount(activeCount || 0)
    }

    const { count: monthlyCount, error: monthlyVisitsError } = await supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('house_id', houseData.id)
      .gte('created_at', startOfMonth)
      .lt('created_at', startOfNextMonth)

    if (monthlyVisitsError) {
      console.error('Error loading monthly visits count:', monthlyVisitsError)
      toast.error('No se pudieron cargar las visitas del mes')
    } else {
      setMonthlyVisitsCount(monthlyCount || 0)
    }

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadMyHouse)
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
            <div className="h-4 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-8 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-4 w-48 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-4 w-40 rounded-full bg-slate-200 dark:bg-slate-700" />
          </section>
          <section className="grid gap-3">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
                <div className="h-4 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-7 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </section>
        </div>
      </main>
    )
  }

  if (
    !profile ||
    profile.role !== 'resident' ||
    profile.status !== 'approved' ||
    !profile.house_id ||
    !house
  ) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Mi casa</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            Acceso no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Tu perfil debe estar aprobado como residente y tener una casa
            asignada.
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

  const residentLimit = house.resident_limit || 3

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
          <p className="text-sm text-slate-300">Mi casa</p>
          <h1 className="mt-1 text-3xl font-bold">
            {house.block}-{house.house_number}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {residential?.name || 'Residencial no disponible'}
          </p>
          <div className="mt-5 grid gap-2 text-sm text-slate-200">
            <p>
              Seguridad activa:{' '}
              <span className="font-semibold text-white">
                {house.pays_security ? 'Sí' : 'No'}
              </span>
            </p>
            <p>
              Usuarios app permitidos:{' '}
              <span className="font-semibold text-white">{residentLimit}</span>
            </p>
            <p>
              Usuarios aprobados:{' '}
              <span className="font-semibold text-white">
                {approvedResidents.length} / {residentLimit}
              </span>
            </p>
          </div>
        </header>

        <Link
          href="/dashboard/visits/new"
          className="block min-h-12 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 text-center font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          Nueva visita
        </Link>

        <section className="grid gap-3">
          <KpiCard label="Visitas activas" value={activeVisitsCount} />
          <KpiCard label="Visitas este mes" value={monthlyVisitsCount} />
        </section>

        <section className="space-y-3 rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Residentes
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
              Usuarios aprobados
            </h2>
          </div>

          {approvedResidents.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-4 text-sm text-slate-500 dark:text-slate-400">
              No hay residentes aprobados en esta casa.
            </div>
          ) : (
            <div className="space-y-3">
              {approvedResidents.map((resident) => (
                <article
                  key={resident.id}
                  className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4"
                >
                  <p className="font-bold text-slate-900 dark:text-white">
                    {resident.first_name} {resident.last_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {resident.phone || 'Sin teléfono'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{value}</p>
    </article>
  )
}
