'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, LogIn, LogOut, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/ui'

type EventToken = {
  id: string
  event_id: string
  residential_id: string
  token: string
  status: string
  expires_at: string
}

type EventRecord = {
  id: string
  residential_id: string
  house_id: string
  created_by: string
  title: string
  event_date: string
  valid_until: string
  status: string
}

type EventGuest = {
  id: string
  event_id: string
  guest_name: string
  status: string
  checked_in_at: string | null
  checked_out_at: string | null
}

type House = {
  id: string
  block: string
  house_number: string
}

type Host = {
  id: string
  first_name: string
  last_name: string
}

type AccessProfile = {
  id: string
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
  residential_id: string | null
}

type ScanState =
  | { status: 'loading' }
  | { status: 'error'; title: string }
  | {
      status: 'success'
      token: EventToken
      event: EventRecord
      guests: EventGuest[]
      house: House | null
      host: Host | null
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

function guestStatusLabel(status: string) {
  if (status === 'inside') return 'Dentro'
  if (status === 'completed') return 'Salió'
  return 'Pendiente'
}

export default function EventScanPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-6 text-white">
          <section className="w-full max-w-sm rounded-2xl bg-white/10 p-6 text-center">
            <p className="text-sm font-semibold text-slate-300">Evento</p>
            <h1 className="mt-2 text-3xl font-black">Validando QR...</h1>
          </section>
        </main>
      }
    >
      <EventScanContent />
    </Suspense>
  )
}

function EventScanContent() {
  const searchParams = useSearchParams()
  const tokenValue = searchParams.get('token')?.trim() || ''
  const [state, setState] = useState<ScanState>({ status: 'loading' })
  const [savingGuestId, setSavingGuestId] = useState<string | null>(null)

  const loadEvent = useCallback(async () => {
    if (!tokenValue) {
      setState({ status: 'error', title: 'QR inválido' })
      return
    }

    setState({ status: 'loading' })

    const { data: tokenData, error: tokenError } = await supabase
      .from('event_qr_tokens')
      .select('id,event_id,residential_id,token,status,expires_at')
      .eq('token', tokenValue)
      .single()

    if (tokenError || !tokenData) {
      console.error('Error loading event token:', tokenError)
      setState({ status: 'error', title: 'QR inválido' })
      return
    }

    const eventToken = tokenData as EventToken

    if (
      eventToken.status !== 'active' ||
      new Date(eventToken.expires_at) <= new Date()
    ) {
      setState({ status: 'error', title: 'QR vencido o no disponible' })
      return
    }

    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id,residential_id,house_id,created_by,title,event_date,valid_until,status')
      .eq('id', eventToken.event_id)
      .single()

    if (eventError || !eventData) {
      console.error('Error loading event:', eventError)
      setState({ status: 'error', title: 'Evento no encontrado' })
      return
    }

    const event = eventData as EventRecord

    if (event.status !== 'active' || new Date(event.valid_until) <= new Date()) {
      setState({ status: 'error', title: 'Evento vencido o cancelado' })
      return
    }

    const [
      { data: guestsData, error: guestsError },
      { data: houseData },
      { data: hostData },
    ] = await Promise.all([
      supabase
        .from('event_guests')
        .select('id,event_id,guest_name,status,checked_in_at,checked_out_at,created_at')
        .eq('event_id', event.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('houses')
        .select('id,block,house_number')
        .eq('id', event.house_id)
        .single(),
      supabase
        .from('profiles')
        .select('id,first_name,last_name')
        .eq('id', event.created_by)
        .single(),
    ])

    if (guestsError) {
      console.error('Error loading event guests:', guestsError)
      setState({ status: 'error', title: 'No se pudieron cargar invitados' })
      return
    }

    setState({
      status: 'success',
      token: eventToken,
      event,
      guests: (guestsData || []) as EventGuest[],
      house: (houseData as House | null) || null,
      host: (hostData as Host | null) || null,
    })
  }, [tokenValue])

  useEffect(() => {
    void Promise.resolve().then(loadEvent)
  }, [loadEvent])

  const updateGuestStatus = async (guest: EventGuest) => {
    if (state.status !== 'success') return

    setSavingGuestId(guest.id)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesión como guardia')
      setSavingGuestId(null)
      return
    }

    const { data: guardData, error: guardError } = await supabase
      .from('profiles')
      .select('id,role,status,residential_id')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (guardError || !guardData) {
      console.error('Error loading guard profile:', guardError)
      toast.error('No se pudo validar el guardia')
      setSavingGuestId(null)
      return
    }

    const accessProfile = guardData as AccessProfile

    const canValidateEvent =
      accessProfile.status === 'approved' &&
      (accessProfile.role === 'super_admin' ||
        ((accessProfile.role === 'guard' || accessProfile.role === 'admin') &&
          accessProfile.residential_id === state.event.residential_id))

    if (!canValidateEvent) {
      toast.error('Tu perfil no esta habilitado para este evento')
      setSavingGuestId(null)
      return
    }

    const now = new Date().toISOString()
    const action = guest.status === 'inside' ? 'exit' : 'entry'
    const nextPayload =
      guest.status === 'inside'
        ? {
            status: 'completed',
            checked_out_at: now,
          }
        : {
            status: 'inside',
            checked_in_at: now,
            checked_out_at: null,
          }

    const { error } = await supabase
      .from('event_guests')
      .update(nextPayload)
      .eq('id', guest.id)

    if (error) {
      console.error('Error updating event guest:', error)
      toast.error('No se pudo actualizar el invitado')
      setSavingGuestId(null)
      return
    }

    const { error: auditError } = await supabase
      .from('event_guest_entries')
      .insert({
        residential_id: state.event.residential_id,
        event_id: state.event.id,
        event_guest_id: guest.id,
        guard_id: accessProfile.id,
        action,
        occurred_at: now,
      })

    if (auditError) {
      console.error('Error creating event guest audit:', auditError)
      toast.error('Ingreso actualizado, pero no se pudo auditar')
      setSavingGuestId(null)
      return
    }

    toast.success(
      guest.status === 'inside' ? 'Salida registrada' : 'Ingreso registrado',
    )
    setSavingGuestId(null)
    await loadEvent()
  }

  if (state.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-6 text-white">
        <section className="w-full max-w-sm rounded-2xl bg-white/10 p-6 text-center">
          <p className="text-sm font-semibold text-slate-300">Evento</p>
          <h1 className="mt-2 text-3xl font-black">Validando QR...</h1>
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-red-950 px-5 py-6 text-white">
        <section className="w-full max-w-sm rounded-2xl bg-white/10 p-6 text-center">
          <XCircle className="mx-auto h-14 w-14 text-red-200" />
          <h1 className="mt-3 text-3xl font-black">{state.title}</h1>
          <p className="mt-3 text-sm leading-6 text-red-100">
            Verifica que el QR sea de evento, que no haya vencido y que tu
            usuario de guardia tenga permisos para este residencial.
          </p>
          <button
            type="button"
            onClick={() => void loadEvent()}
            className="mt-6 min-h-12 w-full rounded-2xl bg-white px-4 py-3 font-black text-red-800 active:scale-[0.99]"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="mt-3 block min-h-12 w-full rounded-2xl border border-white/40 px-4 py-3 text-center font-black text-white active:scale-[0.99]"
          >
            Volver al dashboard
          </Link>
        </section>
      </main>
    )
  }

  const houseLabel = state.house
    ? `Casa ${state.house.block}-${state.house.house_number}`
    : 'Casa'
  const hostLabel = state.host
    ? `${state.host.first_name} ${state.host.last_name}`
    : 'Residente'

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
      <div className="mx-auto max-w-sm space-y-5">
        <Link
          href="/dashboard"
          className="block min-h-11 rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm active:scale-[0.99] dark:bg-slate-800 dark:text-slate-200"
        >
          Volver al dashboard
        </Link>

        <section className="rounded-2xl bg-[#14231C] p-6 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-1 h-7 w-7 flex-shrink-0 text-emerald-300" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-100">
                Evento válido
              </p>
              <h1 className="mt-1 text-2xl font-black leading-tight">
                {state.event.title}
              </h1>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs text-slate-300">Casa</p>
              <p className="mt-1 font-bold">{houseLabel}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs text-slate-300">Anfitrión</p>
              <p className="mt-1 font-bold">{hostLabel}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-300">
            {formatDate(state.event.event_date)}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">
            Invitados
          </h2>

          {state.guests.length === 0 && (
            <div className="rounded-2xl bg-white p-5 text-sm leading-6 text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
              Este evento no tiene invitados registrados.
            </div>
          )}

          {state.guests.map((guest) => {
            const canCheckIn = guest.status === 'pending'
            const canCheckOut = guest.status === 'inside'

            return (
              <article
                key={guest.id}
                className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-950 dark:text-white">
                      {guest.guest_name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {guestStatusLabel(guest.status)}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      guest.status === 'inside'
                        ? 'green'
                        : guest.status === 'completed'
                          ? 'slate'
                          : 'amber'
                    }
                  >
                    {guestStatusLabel(guest.status)}
                  </StatusBadge>
                </div>

                {(canCheckIn || canCheckOut) && (
                  <button
                    type="button"
                    onClick={() => void updateGuestStatus(guest)}
                    disabled={savingGuestId === guest.id}
                    className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold text-white transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] ${
                      canCheckOut ? 'bg-slate-950' : 'bg-[#15936A]'
                    }`}
                  >
                    {savingGuestId === guest.id ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : canCheckOut ? (
                      <LogOut className="h-5 w-5" />
                    ) : (
                      <LogIn className="h-5 w-5" />
                    )}
                    {savingGuestId === guest.id
                      ? 'Guardando...'
                      : canCheckOut
                        ? 'Registrar salida'
                        : 'Registrar ingreso'}
                  </button>
                )}
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
