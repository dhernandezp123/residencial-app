'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CalendarDays, Plus, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { EventQrCard } from './EventQrCard'

type Profile = {
  id: string
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
}

type EventRecord = {
  id: string
  title: string
  event_date: string
  valid_until: string
  status: string
  created_at: string
}

type EventToken = {
  event_id: string
  token: string
  status: string
  expires_at: string
}

type EventWithMeta = EventRecord & {
  guestCount: number
  token: EventToken | null
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  cancelled: 'Cancelado',
  expired: 'Vencido',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function EventsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<EventWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [qrImagesByEventId, setQrImagesByEventId] = useState<Record<string, string>>(
    {},
  )

  const loadEvents = useCallback(async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesión para ver tus eventos')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,role,status')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError || !profileData) {
      console.error('Error loading profile:', profileError)
      toast.error('No se pudo cargar tu perfil')
      setLoading(false)
      return
    }

    setProfile(profileData)

    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('id,title,event_date,valid_until,status,created_at')
      .eq('created_by', profileData.id)
      .order('event_date', { ascending: false })

    if (eventsError) {
      console.error('Error loading events:', eventsError)
      toast.error('No se pudieron cargar tus eventos')
      setLoading(false)
      return
    }

    const loadedEvents = (eventsData || []) as EventRecord[]
    const eventIds = loadedEvents.map((event) => event.id)
    const guestCountByEventId: Record<string, number> = {}
    const tokenByEventId: Record<string, EventToken> = {}

    if (eventIds.length > 0) {
      const [{ data: guestsData }, { data: tokensData, error: tokensError }] =
        await Promise.all([
          supabase.from('event_guests').select('event_id').in('event_id', eventIds),
          supabase
            .from('event_qr_tokens')
            .select('event_id,token,status,expires_at')
            .in('event_id', eventIds)
            .order('created_at', { ascending: false }),
        ])

      ;(guestsData || []).forEach((guest: { event_id: string }) => {
        guestCountByEventId[guest.event_id] =
          (guestCountByEventId[guest.event_id] || 0) + 1
      })

      if (tokensError) {
        console.error('Error loading event tokens:', tokensError)
      } else {
        ;((tokensData || []) as EventToken[]).forEach((token) => {
          if (!tokenByEventId[token.event_id]) {
            tokenByEventId[token.event_id] = token
          }
        })
      }
    }

    setEvents(
      loadedEvents.map((event) => ({
        ...event,
        guestCount: guestCountByEventId[event.id] || 0,
        token: tokenByEventId[event.id] || null,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadEvents)
  }, [loadEvents])

  const getEffectiveStatus = (event: EventWithMeta) => {
    if (event.status === 'active' && new Date(event.valid_until) <= new Date()) {
      return 'expired'
    }

    return event.status
  }

  const handleCancelEvent = async (event: EventWithMeta) => {
    if (cancelConfirmId !== event.id) {
      setCancelConfirmId(event.id)
      return
    }

    setActionLoadingId(event.id)

    const { error: eventError } = await supabase
      .from('events')
      .update({ status: 'cancelled' })
      .eq('id', event.id)

    if (eventError) {
      console.error('Error cancelling event:', eventError)
      toast.error('No se pudo cancelar el evento')
      setActionLoadingId(null)
      return
    }

    const { error: tokenError } = await supabase
      .from('event_qr_tokens')
      .update({ status: 'cancelled' })
      .eq('event_id', event.id)

    if (tokenError) {
      console.error('Error cancelling event token:', tokenError)
      toast.error('Evento cancelado, pero no se pudo cancelar el QR')
    } else {
      toast.success('Evento cancelado')
    }

    setExpandedEventId((current) => (current === event.id ? null : current))
    setCancelConfirmId(null)
    setActionLoadingId(null)
    await loadEvents()
  }

  const handleToggleQr = async (event: EventWithMeta) => {
    const effectiveStatus = getEffectiveStatus(event)

    if (!event.token || event.token.status !== 'active') {
      toast.error('Este evento no tiene QR activo')
      return
    }

    if (effectiveStatus !== 'active') {
      toast.error('Este evento ya no está activo')
      return
    }

    if (expandedEventId === event.id) {
      setExpandedEventId(null)
      return
    }

    setExpandedEventId(event.id)

    if (qrImagesByEventId[event.id]) {
      return
    }

    const shareUrl = `${window.location.origin}/gate/event-scan?token=${event.token.token}`
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })

    setQrImagesByEventId((current) => ({ ...current, [event.id]: qrDataUrl }))
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
      <div className="mx-auto max-w-sm space-y-5">
        <PageHeader title="Mis eventos" />

        <Link
          href="/dashboard/events/new"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#15936A] px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          Nuevo evento
        </Link>

        {loading && (
          <div className="space-y-3">
            <div className="h-32 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
            <div className="h-32 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
          </div>
        )}

        {!loading && profile?.role !== 'resident' && (
          <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
            <h1 className="text-xl font-bold text-slate-950 dark:text-white">
              Eventos para residentes
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Inicia sesión como residente para administrar invitaciones
              grupales.
            </p>
          </section>
        )}

        {!loading && profile?.role === 'resident' && events.length === 0 && (
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-slate-800">
            <CalendarDays className="mx-auto h-10 w-10 text-[#15936A]" />
            <h1 className="mt-3 text-xl font-bold text-slate-950 dark:text-white">
              Aún no tienes eventos
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Crea una invitación grupal para compartir un solo QR con tus
              invitados.
            </p>
          </section>
        )}

        {!loading && profile?.role === 'resident' && events.length > 0 && (
          <div className="space-y-3">
            {events.map((event) => {
              const effectiveStatus = getEffectiveStatus(event)
              const canUseQr =
                effectiveStatus === 'active' && event.token?.status === 'active'
              const shareUrl = event.token
                ? `${window.location.origin}/gate/event-scan?token=${event.token.token}`
                : ''
              const qrDataUrl = qrImagesByEventId[event.id]

              return (
                <section
                  key={event.id}
                  className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                        {event.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {formatDate(event.event_date)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        effectiveStatus === 'active'
                          ? 'bg-emerald-50 text-[#15936A]'
                          : effectiveStatus === 'cancelled'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {statusLabels[effectiveStatus] || effectiveStatus}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
                      <p className="text-xs font-semibold text-slate-500">
                        Invitados
                      </p>
                      <p className="mt-1 font-bold text-slate-950 dark:text-white">
                        {event.guestCount}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
                      <p className="text-xs font-semibold text-slate-500">
                        Válido hasta
                      </p>
                      <p className="mt-1 font-bold text-slate-950 dark:text-white">
                        {formatDate(event.valid_until)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleQr(event)}
                      disabled={!canUseQr}
                      className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-800 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                    >
                      {expandedEventId === event.id ? 'Ocultar QR' : 'Ver / compartir QR'}
                    </button>

                    {effectiveStatus === 'active' && (
                      <button
                        type="button"
                        onClick={() => void handleCancelEvent(event)}
                        disabled={actionLoadingId === event.id}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 px-4 py-3 font-semibold text-red-700 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 dark:border-red-900/40"
                      >
                        <XCircle className="h-5 w-5" />
                        {actionLoadingId === event.id
                          ? 'Cancelando...'
                          : cancelConfirmId === event.id
                            ? 'Confirmar cancelación'
                            : 'Cancelar evento'}
                      </button>
                    )}
                  </div>

                  {expandedEventId === event.id && qrDataUrl && event.token && canUseQr && (
                    <div className="mt-4">
                      <EventQrCard
                        qrDataUrl={qrDataUrl}
                        eventTitle={event.title}
                        shareUrl={shareUrl}
                      />
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
