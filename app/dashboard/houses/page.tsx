'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/app/components/PageHeader'

type House = {
  id: string
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: number | null
  is_active: boolean | null
  notes: string | null
}

type FormData = {
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: string
  notes: string
}

const initialForm: FormData = {
  block: '',
  house_number: '',
  pays_security: true,
  resident_limit: '3',
  notes: '',
}

export default function AdminHousesPage() {
  const [residentialId, setResidentialId] = useState<string | null>(null)
  const [residentialName, setResidentialName] = useState('')
  const [houses, setHouses] = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialForm)

  const loadData = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('residential_id,role,status')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin' || profile.status !== 'approved') {
      toast.error('Acceso no autorizado')
      setLoading(false)
      return
    }

    if (!profile.residential_id) {
      toast.error('No tienes un residencial asignado')
      setLoading(false)
      return
    }

    setResidentialId(profile.residential_id)

    const [{ data: residentialData }, { data: housesData, error: housesError }] =
      await Promise.all([
        supabase
          .from('residentials')
          .select('name')
          .eq('id', profile.residential_id)
          .single(),
        supabase
          .from('houses')
          .select('id,block,house_number,pays_security,resident_limit,is_active,notes')
          .eq('residential_id', profile.residential_id)
          .order('block')
          .order('house_number'),
      ])

    if (residentialData) setResidentialName(residentialData.name)

    if (housesError) {
      toast.error('No se pudieron cargar las casas')
    } else {
      setHouses((housesData || []) as House[])
    }

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  const handleCreateHouse = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!residentialId) return
    if (!formData.block.trim() || !formData.house_number.trim()) {
      toast.error('Bloque y número de casa son requeridos')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('houses').insert({
      residential_id: residentialId,
      block: formData.block.trim().toUpperCase(),
      house_number: formData.house_number.trim(),
      pays_security: formData.pays_security,
      resident_limit: formData.resident_limit ? parseInt(formData.resident_limit) : null,
      notes: formData.notes.trim() || null,
      is_active: true,
    })

    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }

    toast.success('Casa registrada correctamente')
    setFormData(initialForm)
    setShowForm(false)
    await loadData()
    setSaving(false)
  }

  const handleToggleActive = async (house: House) => {
    const { error } = await supabase
      .from('houses')
      .update({ is_active: !house.is_active })
      .eq('id', house.id)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(house.is_active ? 'Casa desactivada' : 'Casa activada')
    setHouses((prev) =>
      prev.map((h) => (h.id === house.id ? { ...h, is_active: !h.is_active } : h))
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-14 animate-pulse rounded-2xl bg-slate-300" />
          <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <PageHeader
          title="Casas"
          subtitle={residentialName || 'Tu residencial'}
        />

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="min-h-14 w-full rounded-2xl bg-slate-950 px-4 py-4 text-center text-lg font-bold text-white shadow-sm active:scale-[0.99]"
        >
          {showForm ? 'Cancelar' : '+ Registrar casa'}
        </button>

        {showForm && (
          <form
            onSubmit={handleCreateHouse}
            className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-bold text-slate-950">Nueva casa</p>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">Bloque</span>
                <input
                  value={formData.block}
                  onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                  placeholder="Ej: A"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">Número</span>
                <input
                  value={formData.house_number}
                  onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                  placeholder="Ej: 24"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
                  required
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">Límite de residentes</span>
              <input
                value={formData.resident_limit}
                onChange={(e) => setFormData({ ...formData, resident_limit: e.target.value })}
                type="number"
                min="1"
                max="20"
                placeholder="Ej: 3"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
              />
              <p className="text-xs leading-5 text-slate-500">
                Cantidad máxima de residentes aprobados que pueden anunciar visitas desde esta casa.
              </p>
            </label>

            <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
              <input
                type="checkbox"
                checked={formData.pays_security}
                onChange={(e) => setFormData({ ...formData, pays_security: e.target.checked })}
                className="h-5 w-5 rounded accent-slate-950"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800">Paga seguridad</p>
                <p className="text-xs text-slate-500">
                  Solo casas activas con seguridad pagada pueden generar QRs.
                </p>
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">Notas (opcional)</span>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observaciones adicionales"
                className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
            >
              {saving ? 'Guardando...' : 'Guardar casa'}
            </button>
          </form>
        )}

        {houses.length === 0 ? (
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-950">Sin casas registradas</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Registra la primera casa para que los residentes puedan generar visitas.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {houses.length} casa{houses.length !== 1 ? 's' : ''} registrada{houses.length !== 1 ? 's' : ''}
            </p>
            {houses.map((house) => (
              <article
                key={house.id}
                className={`rounded-2xl bg-white p-5 shadow-sm ${!house.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Casa
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">
                      {house.block}-{house.house_number}
                    </h2>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        house.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {house.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        house.pays_security
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {house.pays_security ? 'Seguridad ✓' : 'Sin seguridad'}
                    </span>
                  </div>
                </div>

                {house.resident_limit !== null && (
                  <p className="mt-3 text-sm text-slate-500">
                    Límite: <span className="font-semibold text-slate-700">{house.resident_limit} residente{house.resident_limit !== 1 ? 's' : ''}</span>
                  </p>
                )}

                {house.notes && (
                  <p className="mt-1 text-sm text-slate-500">{house.notes}</p>
                )}

                <button
                  type="button"
                  onClick={() => void handleToggleActive(house)}
                  className={`mt-4 min-h-10 w-full rounded-xl px-4 py-2 text-sm font-semibold active:scale-[0.99] ${
                    house.is_active
                      ? 'border border-slate-200 text-slate-600'
                      : 'bg-slate-950 text-white'
                  }`}
                >
                  {house.is_active ? 'Desactivar casa' : 'Activar casa'}
                </button>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
