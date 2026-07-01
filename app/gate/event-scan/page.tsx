'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Camera,
  CheckCircle,
  ChevronDown,
  LogIn,
  LogOut,
  XCircle,
} from 'lucide-react'
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

type EntryPhotoKind = 'identity' | 'vehicle' | 'plate'

type EntryPhotoFiles = Record<EntryPhotoKind, File | null>

type EventGuestPhotoFiles = Record<string, EntryPhotoFiles>

type EventGuestPhotoUpload = {
  guest: EventGuest
  kind: EntryPhotoKind
  bucket: string
  file: File | null
}

const maxEntryPhotoSizeBytes = 8 * 1024 * 1024

const emptyEntryPhotoFiles = (): EntryPhotoFiles => ({
  identity: null,
  vehicle: null,
  plate: null,
})

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

function EntryPhotoInput({
  id,
  label,
  file,
  onChange,
}: {
  id: string
  label: string
  file: File | null
  onChange: (fileList: FileList | null) => void
}) {
  return (
    <div className="rounded-2xl bg-white p-4 dark:bg-slate-800">
      <label
        htmlFor={id}
        className="block text-sm font-black text-slate-950 dark:text-white"
      >
        {label}
      </label>
      <p className="mt-1 text-sm font-semibold text-slate-500">Requerida</p>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => onChange(event.target.files)}
        className="mt-3 block w-full text-sm font-semibold text-slate-700 file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-3 file:font-black file:text-white dark:text-slate-200"
      />
      {file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={URL.createObjectURL(file)}
          alt={`Vista previa ${label}`}
          className="mt-3 h-32 w-full rounded-xl object-cover"
        />
      )}
    </div>
  )
}

function EventScanContent() {
  const searchParams = useSearchParams()
  const tokenValue = searchParams.get('token')?.trim() || ''
  const [state, setState] = useState<ScanState>({ status: 'loading' })
  const [savingGuestId, setSavingGuestId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [expandedGuestId, setExpandedGuestId] = useState<string | null>(null)
  const [confirmingExitGuestId, setConfirmingExitGuestId] = useState<
    string | null
  >(null)
  const [photoFilesByGuestId, setPhotoFilesByGuestId] =
    useState<EventGuestPhotoFiles>({})

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

  const handleEntryPhotoChange = (
    guestId: string,
    kind: EntryPhotoKind,
    fileList: FileList | null,
  ) => {
    const selectedFile = fileList?.[0] || null

    if (selectedFile && selectedFile.size > maxEntryPhotoSizeBytes) {
      toast.error('La foto debe pesar menos de 8 MB')
      setPhotoFilesByGuestId((current) => ({
        ...current,
        [guestId]: {
          ...(current[guestId] || emptyEntryPhotoFiles()),
          [kind]: null,
        },
      }))
      return
    }

    setPhotoFilesByGuestId((current) => ({
      ...current,
      [guestId]: {
        ...(current[guestId] || emptyEntryPhotoFiles()),
        [kind]: selectedFile,
      },
    }))
  }

  const buildEntryPhotoPath = (
    event: EventRecord,
    guest: EventGuest,
    kind: EntryPhotoKind,
    file: File,
  ) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'jpg'
    const uniqueId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    return `${event.residential_id}/${event.id}/${guest.id}/${kind}-${uniqueId}.${safeExtension}`
  }

  const uploadEntryPhoto = async ({
    guest,
    kind,
    bucket,
    file,
  }: EventGuestPhotoUpload) => {
    if (!file || state.status !== 'success') {
      return null
    }

    const path = buildEntryPhotoPath(state.event, guest, kind, file)
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })

    if (error) {
      throw new Error(error.message)
    }

    return data.path
  }

  const updateGuestStatus = async (guest: EventGuest) => {
    if (state.status !== 'success') return

    const isEntry = guest.status !== 'inside'
    const photoFiles = photoFilesByGuestId[guest.id] || emptyEntryPhotoFiles()

    if (!isEntry && confirmingExitGuestId !== guest.id) {
      setConfirmingExitGuestId(guest.id)
      toast.message('Toca nuevamente para confirmar la salida')
      return
    }

    if (
      isEntry &&
      (!photoFiles.identity || !photoFiles.vehicle || !photoFiles.plate)
    ) {
      setExpandedGuestId(guest.id)
      toast.error('Completa la evidencia fotografica.')
      return
    }

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

    let identityPhotoUrl: string | null = null
    let vehiclePhotoUrl: string | null = null
    let platePhotoUrl: string | null = null

    if (isEntry) {
      try {
        setUploadStatus('Subiendo identidad (1/3)...')
        identityPhotoUrl = await uploadEntryPhoto({
          guest,
          kind: 'identity',
          bucket: 'visitor-identities',
          file: photoFiles.identity,
        })
        setUploadStatus('Subiendo vehiculo (2/3)...')
        vehiclePhotoUrl = await uploadEntryPhoto({
          guest,
          kind: 'vehicle',
          bucket: 'visitor-vehicles',
          file: photoFiles.vehicle,
        })
        setUploadStatus('Subiendo placa (3/3)...')
        platePhotoUrl = await uploadEntryPhoto({
          guest,
          kind: 'plate',
          bucket: 'visitor-plates',
          file: photoFiles.plate,
        })
        setUploadStatus(null)
      } catch (error) {
        console.error('Error uploading event guest entry photo:', error)
        setUploadStatus(null)
        toast.error(
          error instanceof Error
            ? error.message
            : 'No se pudo subir la evidencia fotografica',
        )
        setSavingGuestId(null)
        return
      }
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
        identity_photo_url: identityPhotoUrl,
        vehicle_photo_url: vehiclePhotoUrl,
        plate_photo_url: platePhotoUrl,
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
    setPhotoFilesByGuestId((current) => ({
      ...current,
      [guest.id]: emptyEntryPhotoFiles(),
    }))
    setExpandedGuestId(null)
    setConfirmingExitGuestId(null)
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
            const photoFiles =
              photoFilesByGuestId[guest.id] || emptyEntryPhotoFiles()
            const completedPhotoCount = [
              photoFiles.identity,
              photoFiles.vehicle,
              photoFiles.plate,
            ].filter(Boolean).length
            const isExpanded = expandedGuestId === guest.id
            const isConfirmingExit = confirmingExitGuestId === guest.id

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
                    {guest.checked_out_at && (
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Salida: {formatDate(guest.checked_out_at)}
                      </p>
                    )}
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

                {canCheckIn && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGuestId((current) =>
                        current === guest.id ? null : guest.id,
                      )
                    }
                    className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition-all duration-200 ease-out active:scale-[0.98] dark:bg-slate-700/50"
                    aria-expanded={isExpanded}
                    aria-controls={`event-${guest.id}-evidence`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#15936A] shadow-sm dark:bg-slate-800">
                        <Camera className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-950 dark:text-white">
                          Evidencia
                        </span>
                        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                          {completedPhotoCount}/3 fotos cargadas
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                )}

                {canCheckIn && isExpanded && (
                  <section
                    id={`event-${guest.id}-evidence`}
                    className="mt-3 space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-700/50"
                  >
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Evidencia fotografica
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Requerida antes de registrar ingreso.
                      </p>
                    </div>
                    <EntryPhotoInput
                      id={`event-${guest.id}-identity-photo`}
                      label="Foto identidad"
                      file={photoFiles.identity}
                      onChange={(fileList) =>
                        handleEntryPhotoChange(guest.id, 'identity', fileList)
                      }
                    />
                    <EntryPhotoInput
                      id={`event-${guest.id}-vehicle-photo`}
                      label="Foto vehiculo"
                      file={photoFiles.vehicle}
                      onChange={(fileList) =>
                        handleEntryPhotoChange(guest.id, 'vehicle', fileList)
                      }
                    />
                    <EntryPhotoInput
                      id={`event-${guest.id}-plate-photo`}
                      label="Foto placa"
                      file={photoFiles.plate}
                      onChange={(fileList) =>
                        handleEntryPhotoChange(guest.id, 'plate', fileList)
                      }
                    />
                  </section>
                )}

                {(canCheckIn || canCheckOut) && (
                  <button
                    type="button"
                    onClick={() => void updateGuestStatus(guest)}
                    disabled={savingGuestId === guest.id}
                    className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold text-white transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] ${
                      canCheckOut
                        ? isConfirmingExit
                          ? 'bg-amber-500 text-amber-950'
                          : 'bg-slate-950'
                        : 'bg-[#15936A]'
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
                      ? uploadStatus || 'Registrando...'
                      : canCheckOut
                        ? isConfirmingExit
                          ? 'Confirmar salida'
                          : 'Registrar salida'
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
