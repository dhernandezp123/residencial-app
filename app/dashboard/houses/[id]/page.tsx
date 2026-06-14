'use client'

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
      }[]
    | null
}

type HousePageProps = {
  params: Promise<{
    id: string
  }>
}

export default function HouseDetailPage({ params }: HousePageProps) {
  const { id } = use(params)

  const [house, setHouse] = useState<HouseDetail | null>(null)
  const [loading, setLoading] = useState(true)

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
      residentials: houseRow.residentials?.[0] || null,
    })
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadHouse)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-28 rounded-full bg-slate-200" />

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="h-4 w-24 rounded-full bg-slate-200" />
            <div className="mt-3 h-8 w-36 rounded-full bg-slate-200" />
            <div className="mt-4 h-4 w-48 rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-40 rounded-full bg-slate-200" />
          </section>

          <section className="grid gap-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
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
        <Link
          href={`/dashboard/residentials/${house.residential_id}`}
          className="block text-sm font-semibold text-slate-600"
        >
          ← Volver al residencial
        </Link>

        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Casa</p>
          <h1 className="mt-1 text-3xl font-bold">
            {house.block}-{house.house_number}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {house.residentials?.name || 'Residencial no disponible'}
          </p>
          <div className="mt-5 grid gap-2 text-sm text-slate-200">
            <p>
              Paga seguridad:{' '}
              <span className="font-semibold text-white">
                {house.pays_security ? 'Sí' : 'No'}
              </span>
            </p>
            <p>
              Usuarios app permitidos:{' '}
              <span className="font-semibold text-white">
                {house.resident_limit || 3}
              </span>
            </p>
          </div>
        </header>

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
        </section>

        <section className="grid gap-3">
          <KpiCard label="Residentes aprobados" value="0" />
          <KpiCard label="Residentes pendientes" value="0" />
          <KpiCard label="Visitas activas" value="0" />
        </section>

        <section className="grid gap-3">
          <PlaceholderAction title="Residentes" />
          <PlaceholderAction title="Visitas" />
          <PlaceholderAction title="Historial" />
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

function PlaceholderAction({ title }: { title: string }) {
  return (
    <button
      type="button"
      disabled
      className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-400 shadow-sm"
    >
      {title}
    </button>
  )
}
