'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Residential = {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  max_houses: number | null
  is_active: boolean | null
}

type House = {
  id: string
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: number | null
  is_active: boolean | null
  notes: string | null
}

export default function ResidentialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [residential, setResidential] = useState<Residential | null>(null)
  const [houses, setHouses] = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    block: '',
    house_number: '',
    pays_security: true,
    resident_limit: '3',
    notes: '',
  })

  const loadData = async () => {
    setLoading(true)

    const { data: residentialData, error: residentialError } = await supabase
      .from('residentials')
      .select('id,name,address,city,country,max_houses,is_active')
      .eq('id', id)
      .single()

    if (residentialError) {
      console.error('Error loading residential:', residentialError)
      toast.error('No se pudo cargar el residencial')
      setLoading(false)
      return
    }

    const { data: housesData, error: housesError } = await supabase
      .from('houses')
      .select('id,block,house_number,pays_security,resident_limit,is_active,notes')
      .eq('residential_id', id)
      .order('block', { ascending: true })
      .order('house_number', { ascending: true })

    if (housesError) {
      console.error('Error loading houses:', housesError)
      toast.error('No se pudieron cargar las casas')
    }

    setResidential(residentialData)
    setHouses(housesData || [])
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleCreateHouse = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase.from('houses').insert({
      residential_id: id,
      block: formData.block.trim().toUpperCase(),
      house_number: formData.house_number.trim(),
      pays_security: formData.pays_security,
      resident_limit: Number(formData.resident_limit || 3),
      notes: formData.notes.trim() || null,
      is_active: true,
    })

    setSaving(false)

    if (error) {
      console.error('Error creating house:', error)
      toast.error(error.message)
      return
    }

    toast.success('Casa creada correctamente')

    setFormData({
      block: '',
      house_number: '',
      pays_security: true,
      resident_limit: '3',
      notes: '',
    })

    setShowForm(false)
    loadData()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
          Cargando residencial...
        </div>
      </main>
    )
  }

  if (!residential) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-900">Residencial no encontrado</p>
          <Link href="/dashboard/residentials" className="mt-4 block text-sm font-semibold text-slate-700">
            Volver
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <Link href="/dashboard/residentials" className="text-sm font-semibold text-slate-600">
          ← Volver
        </Link>

        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Residencial</p>
          <h1 className="mt-1 text-2xl font-bold">{residential.name}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {residential.city || 'Sin ciudad'} · {residential.country || 'Sin país'}
          </p>
          <p className="mt-4 text-sm text-slate-300">
            Casas contratadas: <span className="font-semibold text-white">{residential.max_houses || 0}</span>
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Casas registradas: <span className="font-semibold text-white">{houses.length}</span>
          </p>
        </header>

        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full rounded-2xl bg-slate-950 py-4 font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          {showForm ? 'Cancelar' : '+ Nueva casa'}
        </button>

        {showForm && (
          <form
            onSubmit={handleCreateHouse}
            className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
          >
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Lote / bloque
              </span>
              <input
                value={formData.block}
                onChange={(e) =>
                  setFormData({ ...formData, block: e.target.value })
                }
                placeholder="Ej: C o D"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Número de casa
              </span>
              <input
                value={formData.house_number}
                onChange={(e) =>
                  setFormData({ ...formData, house_number: e.target.value })
                }
                placeholder="Ej: 24"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Máximo usuarios app por casa
              </span>
              <input
                value={formData.resident_limit}
                onChange={(e) =>
                  setFormData({ ...formData, resident_limit: e.target.value })
                }
                placeholder="Ej: 3"
                type="number"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
              />
              <p className="text-xs leading-5 text-slate-500">
                Cantidad máxima de residentes aprobados que podrán anunciar
                visitas desde esta casa. No limita la cantidad de visitas.
              </p>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Notas
              </span>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Notas opcionales"
                className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Paga seguridad
              <input
                type="checkbox"
                checked={formData.pays_security}
                onChange={(e) =>
                  setFormData({ ...formData, pays_security: e.target.checked })
                }
                className="h-5 w-5"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-slate-950 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar casa'}
            </button>
          </form>
        )}

        {houses.length === 0 ? (
          <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
            No hay casas registradas.
          </div>
        ) : (
          <section className="space-y-3">
            {houses.map((house) => (
              <article key={house.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {house.block}-{house.house_number}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Usuarios app permitidos: {house.resident_limit || 3}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      house.pays_security
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {house.pays_security ? 'Paga' : 'No paga'}
                  </span>
                </div>

                {house.notes && (
                  <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    {house.notes}
                  </p>
                )}

                <Link
                  href={`/dashboard/houses/${house.id}`}
                  className="mt-5 block min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-800 active:scale-[0.99]"
                >
                  Ver casa
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
