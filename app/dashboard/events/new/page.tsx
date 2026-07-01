'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { EventQrCard } from '../EventQrCard'

type Profile = {
  id: string
  first_name: string
  last_name: string
  residential_id: string | null
  house_id: string | null
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
}

type EventFormData = {
  title: string
  event_date: string
  valid_until: string
  guests: string[]
}

type CreatedEvent = {
  title: string
  shareUrl: string
  qrDataUrl: string
  hostName: string
  houseLabel: string
  eventDate: string
  validUntil: string
  guestCount: number
}

function toLocalDateTimeInput(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function buildInitialFormData(): EventFormData {
  const eventDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const validUntil = new Date(eventDate.getTime() + 6 * 60 * 60 * 1000)

  return {
    title: '',
    event_date: toLocalDateTimeInput(eventDate),
    valid_until: toLocalDateTimeInput(validUntil),
    guests: [''],
  }
}

function generateEventToken() {
  return `${crypto.randomUUID().replaceAll('-', '')}${crypto
    .randomUUID()
    .replaceAll('-', '')}`
}

export default function NewEventPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<EventFormData>(() =>
    buildInitialFormData(),
  )
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null)
  const [houseLabel, setHouseLabel] = useState('Casa')

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        toast.error('Inicia sesión para crear eventos')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id,first_name,last_name,residential_id,house_id,role,status')
        .eq('user_id', sessionData.session.user.id)
        .single()

      if (error || !data) {
        console.error('Error loading profile:', error)
        toast.error('No se pudo cargar tu perfil')
        setLoading(false)
        return
      }

      setProfile(data)

      if (data.house_id) {
        const { data: houseData, error: houseError } = await supabase
          .from('houses')
          .select('block,house_number')
          .eq('id', data.house_id)
          .single()

        if (!houseError && houseData) {
          setHouseLabel(`Casa ${houseData.block}-${houseData.house_number}`)
        }
      }

      setLoading(false)
    }

    void loadProfile()
  }, [])

  const canCreateEvent =
    profile?.status === 'approved' &&
    profile.role === 'resident' &&
    Boolean(profile.residential_id) &&
    Boolean(profile.house_id)

  const updateGuest = (index: number, value: string) => {
    setFormData((current) => ({
      ...current,
      guests: current.guests.map((guest, guestIndex) =>
        guestIndex === index ? value : guest,
      ),
    }))
  }

  const addGuest = () => {
    setFormData((current) => ({
      ...current,
      guests: [...current.guests, ''],
    }))
  }

  const removeGuest = (index: number) => {
    setFormData((current) => ({
      ...current,
      guests:
        current.guests.length === 1
          ? ['']
          : current.guests.filter((_, guestIndex) => guestIndex !== index),
    }))
  }

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!profile || !canCreateEvent || !profile.residential_id || !profile.house_id) {
      toast.error('Tu perfil no está habilitado para crear eventos')
      return
    }

    const cleanGuests = formData.guests
      .map((guest) => guest.trim())
      .filter(Boolean)
    const eventDate = new Date(formData.event_date)
    const validUntil = new Date(formData.valid_until)

    if (!formData.title.trim()) {
      toast.error('Escribe el nombre del evento')
      return
    }

    if (cleanGuests.length === 0) {
      toast.error('Agrega al menos un invitado')
      return
    }

    if (
      Number.isNaN(eventDate.getTime()) ||
      Number.isNaN(validUntil.getTime()) ||
      validUntil <= eventDate
    ) {
      toast.error('El vencimiento debe ser posterior al inicio del evento')
      return
    }

    setSaving(true)

    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert({
        residential_id: profile.residential_id,
        house_id: profile.house_id,
        created_by: profile.id,
        title: formData.title.trim(),
        event_date: eventDate.toISOString(),
        valid_until: validUntil.toISOString(),
        status: 'active',
      })
      .select('id,title')
      .single()

    if (eventError || !eventData) {
      console.error('Error creating event:', eventError)
      toast.error(eventError?.message || 'No se pudo crear el evento')
      setSaving(false)
      return
    }

    const { error: guestsError } = await supabase.from('event_guests').insert(
      cleanGuests.map((guestName) => ({
        event_id: eventData.id,
        guest_name: guestName,
        status: 'pending',
      })),
    )

    if (guestsError) {
      console.error('Error creating event guests:', guestsError)
      toast.error(guestsError.message || 'No se pudieron guardar invitados')
      setSaving(false)
      return
    }

    const token = generateEventToken()
    const { error: tokenError } = await supabase.from('event_qr_tokens').insert({
      event_id: eventData.id,
      residential_id: profile.residential_id,
      token,
      status: 'active',
      expires_at: validUntil.toISOString(),
    })

    if (tokenError) {
      console.error('Error creating event QR token:', tokenError)
      toast.error(tokenError.message || 'No se pudo generar el QR del evento')
      setSaving(false)
      return
    }

    const shareUrl = `${window.location.origin}/gate/event-scan?token=${token}`
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })

    setCreatedEvent({
      title: eventData.title,
      shareUrl,
      qrDataUrl,
      hostName: `${profile.first_name} ${profile.last_name}`,
      houseLabel,
      eventDate: eventDate.toISOString(),
      validUntil: validUntil.toISOString(),
      guestCount: cleanGuests.length,
    })
    setFormData(buildInitialFormData())
    setSaving(false)
    toast.success('Evento creado')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-96 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
        </div>
      </main>
    )
  }

  if (!canCreateEvent) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
            Acceso no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Tu perfil debe estar aprobado como residente y tener una casa
            asignada para crear eventos.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 block min-h-12 rounded-2xl bg-slate-950 px-4 py-3 text-center font-semibold text-white active:scale-[0.99] dark:bg-slate-700"
          >
            Ir al dashboard
          </Link>
        </div>
      </main>
    )
  }

  if (createdEvent) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
        <div className="mx-auto max-w-sm space-y-5">
          <PageHeader title="Evento creado" backHref="/dashboard/events" />

          <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
            <p className="text-sm font-semibold text-[#15936A]">
              QR grupal listo
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              {createdEvent.title}
            </h1>
            <div className="mt-5">
              <EventQrCard
                qrDataUrl={createdEvent.qrDataUrl}
                eventTitle={createdEvent.title}
                hostName={createdEvent.hostName}
                houseLabel={createdEvent.houseLabel}
                eventDate={createdEvent.eventDate}
                validUntil={createdEvent.validUntil}
                guestCount={createdEvent.guestCount}
                shareUrl={createdEvent.shareUrl}
              />
            </div>
            <Link
              href="/dashboard"
              className="mt-4 block min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-center font-semibold text-slate-800 active:scale-[0.99] dark:border-slate-600 dark:text-slate-200"
            >
              Ir al dashboard
            </Link>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
      <div className="mx-auto max-w-sm space-y-5">
        <PageHeader
          title="Nuevo evento"
          subtitle="Un QR para varios invitados"
          backHref="/dashboard/events"
        />

        <form
          onSubmit={handleCreateEvent}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800"
        >
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Nombre del evento
            </span>
            <input
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Fecha y hora
            </span>
            <input
              value={formData.event_date}
              onChange={(e) =>
                setFormData({ ...formData, event_date: e.target.value })
              }
              type="datetime-local"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Válido hasta
            </span>
            <input
              value={formData.valid_until}
              onChange={(e) =>
                setFormData({ ...formData, valid_until: e.target.value })
              }
              type="datetime-local"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              required
            />
          </label>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Invitados
              </h2>
              <button
                type="button"
                onClick={addGuest}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-[#15936A] transition-all duration-200 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>

            {formData.guests.map((guest, index) => (
              <div key={index} className="flex items-end gap-2">
                <label className="min-w-0 flex-1 space-y-1">
                  <span className="text-xs font-semibold text-slate-500">
                    Invitado {index + 1}
                  </span>
                  <input
                    value={guest}
                    onChange={(e) => updateGuest(index, e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    required={index === 0}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeGuest(index)}
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-all duration-200 active:scale-[0.98] dark:border-slate-600"
                  aria-label="Eliminar invitado"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </section>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#15936A] px-4 py-3 font-semibold text-white transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Creando...
              </>
            ) : (
              'Crear evento y generar QR'
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
