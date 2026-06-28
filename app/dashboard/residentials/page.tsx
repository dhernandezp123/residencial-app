'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Residential = {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  max_houses: number | null
  is_active: boolean | null
  created_at: string
}

export default function ResidentialsPage() {
  const [residentials, setResidentials] = useState<Residential[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: 'San Pedro Sula',
    country: 'Honduras',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    max_houses: '',
  })

  const loadResidentials = async () => {
    const { data, error } = await supabase
      .from('residentials')
      .select(
        'id,name,address,city,country,contact_name,contact_phone,contact_email,max_houses,is_active,created_at'
      )
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading residentials:', error)
      setResidentials([])
    } else {
      setResidentials(data || [])
    }

    setLoading(false)
  }

  const handleCreateResidential = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase.from('residentials').insert({
      name: formData.name,
      address: formData.address,
      city: formData.city,
      country: formData.country,
      contact_name: formData.contact_name,
      contact_phone: formData.contact_phone,
      contact_email: formData.contact_email,
      max_houses: Number(formData.max_houses || 0),
      is_active: true,
    })

    setSaving(false)

    if (error) {
      console.error('Error creating residential:', error)
      toast.error('No se pudo crear el residencial')
      return
    }

    setFormData({
      name: '',
      address: '',
      city: 'San Pedro Sula',
      country: 'Honduras',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      max_houses: '',
    })

    setShowForm(false)
    toast.success('Residencial creada correctamente')
    loadResidentials()
  }

  useEffect(() => {
    void Promise.resolve().then(loadResidentials)
  }, [])

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Super Admin</p>
          <h1 className="mt-1 text-2xl font-bold">Residenciales</h1>
          <p className="mt-2 text-sm text-slate-300">
            Administra comunidades dentro de la plataforma.
          </p>
        </header>

        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full rounded-2xl bg-slate-950 py-4 font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          {showForm ? 'Cancelar' : '+ Nuevo residencial'}
        </button>

        {showForm && (
          <form
            onSubmit={handleCreateResidential}
            className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
          >
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Nombre del residencial
              </span>
              <input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ej: Rancho San Manuel"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Dirección
              </span>
              <input
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Dirección del residencial"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Ciudad
              </span>
              <input
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="Ciudad"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Nombre de contacto
              </span>
              <input
                value={formData.contact_name}
                onChange={(e) =>
                  setFormData({ ...formData, contact_name: e.target.value })
                }
                placeholder="Persona encargada"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Teléfono de contacto
              </span>
              <input
                value={formData.contact_phone}
                onChange={(e) =>
                  setFormData({ ...formData, contact_phone: e.target.value })
                }
                placeholder="Ej: 9999-9999"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Correo de contacto
              </span>
              <input
                value={formData.contact_email}
                onChange={(e) =>
                  setFormData({ ...formData, contact_email: e.target.value })
                }
                placeholder="contacto@correo.com"
                type="email"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Cantidad máxima de casas
              </span>
              <input
                value={formData.max_houses}
                onChange={(e) =>
                  setFormData({ ...formData, max_houses: e.target.value })
                }
                placeholder="Ej: 120"
                type="number"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="min-h-12 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar residencial'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
            Cargando residenciales...
          </div>
        ) : residentials.length === 0 ? (
          <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
            No hay residenciales registrados.
          </div>
        ) : (
          <section className="space-y-3">
            {residentials.map((residential) => (
              <article
                key={residential.id}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {residential.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {residential.city || 'Sin ciudad'} ·{' '}
                      {residential.country || 'Sin país'}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      residential.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {residential.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">
                      Dirección:
                    </span>{' '}
                    {residential.address || 'N/A'}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-800">
                      Contacto:
                    </span>{' '}
                    {residential.contact_name || 'N/A'}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-800">
                      Teléfono:
                    </span>{' '}
                    {residential.contact_phone || 'N/A'}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-800">
                      Casas contratadas:
                    </span>{' '}
                    {residential.max_houses || 0}
                  </p>
                </div>

                <Link
                  href={`/dashboard/residentials/${residential.id}`}
                  className="mt-5 block w-full rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-800 active:scale-[0.99]"
                >
                  Ver detalle
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
