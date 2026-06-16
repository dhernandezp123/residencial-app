'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type QrToken = {
  id: string
  visit_id: string
  residential_id: string
  token: string
  expires_at: string
  status: 'active' | 'used' | 'expired' | 'cancelled'
}

type Visit = {
  id: string
  residential_id: string
  house_id: string
  created_by: string
  visitor_name: string
  visit_type: 'family' | 'delivery' | 'service' | 'provider' | 'other'
  access_mode: 'single_use' | 'multi_use'
  valid_until: string
  status: 'active' | 'used' | 'expired' | 'cancelled'
}

type House = {
  id: string
  residential_id: string
  block: string
  house_number: string
}

type Residential = {
  id: string
  name: string
}

type AnnouncedBy = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
}

type GuardProfile = {
  id: string
  user_id: string
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
}

type RegisteredEntry = {
  action: 'entry' | 'exit'
  visitor_name: string
  house_label: string
  registered_time: string
  entry_time: string | null
}

type OpenEntry = {
  id: string
  entry_time: string
  exit_time: string | null
}

type EntryPhotoKind = 'identity' | 'vehicle' | 'plate'

type EntryPhotoFiles = Record<EntryPhotoKind, File | null>

type EntryPhotoUpload = {
  kind: EntryPhotoKind
  bucket: string
  file: File | null
}

type ScanResult =
  | {
      status: 'loading'
    }
  | {
      status: 'error'
      title: string
    }
  | {
      status: 'success'
      qrToken: QrToken
      visit: Visit
      house: House
      residential: Residential
      announcedBy: AnnouncedBy | null
      openEntry: OpenEntry | null
    }

const visitTypeLabels: Record<Visit['visit_type'], string> = {
  family: 'Familiar',
  delivery: 'Delivery',
  service: 'Servicio',
  provider: 'Proveedor',
  other: 'Otro',
}

export default function GateScanPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-6 text-white">
          <section className="w-full max-w-sm rounded-2xl bg-white/10 p-6 text-center">
            <p className="text-sm font-semibold text-slate-300">Garita</p>
            <h1 className="mt-2 text-3xl font-black">Cargando escáner...</h1>
          </section>
        </main>
      }
    >
      <GateScanContent />
    </Suspense>
  )
}

function GateScanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const [result, setResult] = useState<ScanResult>({ status: 'loading' })
  const [savingEntry, setSavingEntry] = useState(false)
  const [registeredEntry, setRegisteredEntry] = useState<RegisteredEntry | null>(
    null
  )
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [startingCamera, setStartingCamera] = useState(false)
  const [entryPhotoFiles, setEntryPhotoFiles] = useState<EntryPhotoFiles>({
    identity: null,
    vehicle: null,
    plate: null,
  })
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannedRef = useRef(false)

  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }
  const playBeep = (durationMs: number = 500, frequency: number = 880) => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as Window &
            typeof globalThis & {
              webkitAudioContext?: typeof AudioContext
            }
        ).webkitAudioContext

      if (!AudioContextClass) {
        return
      }

      const audioContext = new AudioContextClass()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
      gainNode.gain.setValueAtTime(0.18, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + durationMs / 1000,
      )

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.start()

      const stopHandle = () => {
        try {
          oscillator.stop()
        } catch {}
        try {
          audioContext.close()
        } catch {}
      }

      setTimeout(stopHandle, durationMs)
    } catch (error) {
      console.error('Error playing QR beep:', error)
    }
  }

  type SignalType =
    | 'scan_success'
    | 'scan_error'
    | 'entry_success'
    | 'exit_success'

  function signal(type: SignalType) {
    switch (type) {
      case 'scan_success':
        playBeep(500, 880)
        vibrate([200, 100, 200])
        break
      case 'scan_error':
        playBeep(800, 220)
        vibrate([100, 100, 100, 100, 100])
        break
      case 'entry_success':
        playBeep(500, 880)
        vibrate([200, 100, 200])
        break
      case 'exit_success':
        playBeep(1000, 880)
        vibrate([500])
        break
    }
  }

  const setErrorResult = (title: string) => {
    setResult({ status: 'error', title })
    signal('scan_error')
  }

  const extractTokenFromQr = (decodedText: string) => {
    const trimmedText = decodedText.trim()

    try {
      const decodedUrl = new URL(trimmedText, window.location.origin)

      if (decodedUrl.pathname === '/gate/scan') {
        return decodedUrl.searchParams.get('token')?.trim() || ''
      }
    } catch {
      return trimmedText
    }

    return trimmedText
  }

  const stopScanner = async () => {
    if (!scannerRef.current) {
      return
    }

    try {
      await scannerRef.current.stop()
      await scannerRef.current.clear()
    } catch (error) {
      console.error('Error stopping QR scanner:', error)
    } finally {
      scannerRef.current = null
      setCameraOpen(false)
    }
  }

  const handleOpenCamera = async () => {
    setStartingCamera(true)
    scannedRef.current = false

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('gate-qr-reader')
      scannerRef.current = scanner
      setCameraOpen(true)

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: {
            width: 260,
            height: 260,
          },
        },
        (decodedText) => {
          if (scannedRef.current) {
            return
          }

          const scannedToken = extractTokenFromQr(decodedText)

          if (!scannedToken) {
            signal('scan_error')
            toast.error('QR no válido')
            return
          }

          scannedRef.current = true
          signal('scan_success')
          void stopScanner().then(() => {
            router.push(`/gate/scan?token=${encodeURIComponent(scannedToken)}`)
          })
        },
        () => {}
      )
    } catch (error) {
      console.error('Error opening QR scanner:', error)
      toast.error(
        'El navegador requiere HTTPS para usar la cámara. Abre la app desde una URL segura.',
      )
      setCameraOpen(false)
    } finally {
      setStartingCamera(false)
    }
  }

  const validateToken = async () => {
    setResult({ status: 'loading' })
    setRegisteredEntry(null)
    setOpenEntry(null)
    setEntryPhotoFiles({
      identity: null,
      vehicle: null,
      plate: null,
    })

    if (!token) {
      setErrorResult('QR no encontrado')
      return
    }

    const { data: qrTokenData, error: qrTokenError } = await supabase
      .from('qr_tokens')
      .select('id,visit_id,residential_id,token,expires_at,status')
      .eq('token', token)
      .single()

    if (qrTokenError || !qrTokenData) {
      console.error('Error loading QR token:', qrTokenError)
      setErrorResult('QR inválido')
      return
    }

    const qrToken = qrTokenData as QrToken

    if (qrToken.status !== 'active') {
      setErrorResult('QR no disponible')
      return
    }

    if (new Date(qrToken.expires_at).getTime() <= Date.now()) {
      setErrorResult('QR vencido')
      return
    }

    const { data: visitData, error: visitError } = await supabase
      .from('visits')
      .select(
        'id,residential_id,house_id,created_by,visitor_name,visit_type,access_mode,valid_until,status'
      )
      .eq('id', qrToken.visit_id)
      .single()

    console.log('VISIT:', visitData)

    if (visitError || !visitData) {
      console.error('Error loading visit:', visitError)
      setErrorResult('QR inválido')
      return
    }

    const visit = visitData as Visit

    if (visit.status !== 'active') {
      setErrorResult('QR no disponible')
      return
    }

    const { data: houseData, error: houseError } = await supabase
      .from('houses')
      .select('id,residential_id,block,house_number')
      .eq('id', visit.house_id)
      .single()

    if (houseError || !houseData) {
      console.error('Error loading house:', houseError)
      setErrorResult('QR inválido')
      return
    }

    const house = houseData as House

    const { data: residentialData, error: residentialError } = await supabase
      .from('residentials')
      .select('id,name')
      .eq('id', visit.residential_id)
      .single()

    if (residentialError || !residentialData) {
      console.error('Error loading residential:', residentialError)
      setErrorResult('QR inválido')
      return
    }

    const { data: announcedByData, error: announcedByError } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,phone')
      .eq('id', visit.created_by)
      .single()

    if (announcedByError) {
      console.error('Error loading announced by profile:', announcedByError)
    }

    const { data: openEntryData, error: openEntryError } = await supabase
      .from('visitor_entries')
      .select('id,entry_time,exit_time')
      .eq('visit_id', visit.id)
      .is('exit_time', null)
      .eq('entry_status', 'allowed')
      .order('entry_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (openEntryError) {
      console.error('Error loading open visitor entry:', openEntryError)
      toast.error(openEntryError.message)
    }

    const currentOpenEntry = (openEntryData as OpenEntry | null) || null
    console.log('OPEN ENTRY:', currentOpenEntry, openEntryError)
    setOpenEntry(currentOpenEntry)

    setResult({
      status: 'success',
      qrToken,
      visit,
      house,
      residential: residentialData as Residential,
      announcedBy: (announcedByData as AnnouncedBy | null) || null,
      openEntry: currentOpenEntry,
    })
    signal('scan_success')
  }

  const handleEntryPhotoChange = (
    kind: EntryPhotoKind,
    fileList: FileList | null,
  ) => {
    const selectedFile = fileList?.[0] || null

    setEntryPhotoFiles((currentFiles) => ({
      ...currentFiles,
      [kind]: selectedFile,
    }))
  }

  const buildEntryPhotoPath = (
    resultData: Extract<ScanResult, { status: 'success' }>,
    kind: EntryPhotoKind,
    file: File,
  ) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'jpg'
    const uniqueId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    return `${resultData.visit.residential_id}/${resultData.visit.id}/${kind}-${uniqueId}.${safeExtension}`
  }

  const uploadEntryPhoto = async ({
    kind,
    bucket,
    file,
  }: EntryPhotoUpload) => {
    if (!file || result.status !== 'success') {
      return null
    }

    const path = buildEntryPhotoPath(result, kind, file)
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

  const handleRegisterAccess = async () => {
    if (result.status !== 'success') {
      return
    }

    setSavingEntry(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('No tienes permisos para registrar ingresos')
      setSavingEntry(false)
      return
    }

    const { data: guardProfileData, error: guardProfileError } = await supabase
      .from('profiles')
      .select('id,user_id,role,status')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (guardProfileError || !guardProfileData) {
      console.error('Error loading guard profile:', guardProfileError)
      toast.error('No tienes permisos para registrar ingresos')
      setSavingEntry(false)
      return
    }

    const guardProfile = guardProfileData as GuardProfile
    console.log('Gate Profile:', guardProfile)
    console.log({
      role: guardProfile?.role,
      status: guardProfile?.status,
      user_id: guardProfile?.user_id,
    })

    const canRegister =
      guardProfile.status === 'approved' &&
      ['guard', 'admin', 'super_admin'].includes(guardProfile.role)

    if (!canRegister) {
      toast.error(`role=${guardProfile?.role} status=${guardProfile?.status}`)
      toast.error('No tienes permisos para registrar ingresos')
      setSavingEntry(false)
      return
    }

    const registeredAt = new Date().toISOString()

    if (openEntry) {
      const { error: exitError } = await supabase
        .from('visitor_entries')
        .update({ exit_time: registeredAt })
        .eq('id', openEntry.id)

      if (exitError) {
        console.error('Error registering visitor exit:', exitError)
        toast.error(exitError.message)
        setSavingEntry(false)
        return
      }

      setRegisteredEntry({
        action: 'exit',
        visitor_name: result.visit.visitor_name,
        house_label: `${result.house.block}-${result.house.house_number}`,
        registered_time: registeredAt,
        entry_time: openEntry.entry_time,
      })
      setSavingEntry(false)
      toast.success('Salida registrada correctamente')
      signal('exit_success')
      return
    }

    let identityPhotoUrl: string | null = null
    let vehiclePhotoUrl: string | null = null
    let platePhotoUrl: string | null = null

    try {
      identityPhotoUrl = await uploadEntryPhoto({
        kind: 'identity',
        bucket: 'visitor-identities',
        file: entryPhotoFiles.identity,
      })
      vehiclePhotoUrl = await uploadEntryPhoto({
        kind: 'vehicle',
        bucket: 'visitor-vehicles',
        file: entryPhotoFiles.vehicle,
      })
      platePhotoUrl = await uploadEntryPhoto({
        kind: 'plate',
        bucket: 'visitor-plates',
        file: entryPhotoFiles.plate,
      })
    } catch (error) {
      console.error('Error uploading entry photo:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo subir la evidencia fotogrÃ¡fica',
      )
      setSavingEntry(false)
      return
    }

    const entryPayload = {
      residential_id: result.visit.residential_id,
      visit_id: result.visit.id,
      qr_token_id: result.qrToken.id,
      house_id: result.visit.house_id,
      guard_id: guardProfile.id,
      entry_status: 'allowed',
      notes: null,
      identity_photo_url: identityPhotoUrl,
      vehicle_photo_url: vehiclePhotoUrl,
      plate_photo_url: platePhotoUrl,
    }
    console.log('ENTRY PAYLOAD:', entryPayload)

    const { data: entryData, error: entryError } = await supabase
      .from('visitor_entries')
      .insert(entryPayload)

    console.log('ENTRY INSERT:', entryData, entryError)

    if (entryError) {
      console.error('Error registering visitor entry:', entryError)
      toast.error(entryError.message)
      setSavingEntry(false)
      return
    }

    if (result.visit.access_mode === 'single_use') {
      const { error: qrTokenUpdateError } = await supabase
        .from('qr_tokens')
        .update({
          status: 'used',
          used_at: registeredAt,
        })
        .eq('id', result.qrToken.id)

      if (qrTokenUpdateError) {
        console.error('Error updating QR token:', qrTokenUpdateError)
        toast.error(qrTokenUpdateError.message)
        setSavingEntry(false)
        return
      }

      const { error: visitUpdateError } = await supabase
        .from('visits')
        .update({ status: 'used' })
        .eq('id', result.visit.id)

      if (visitUpdateError) {
        console.error('Error updating visit:', visitUpdateError)
        toast.error(visitUpdateError.message)
        setSavingEntry(false)
        return
      }
    }

    setRegisteredEntry({
      action: 'entry',
      visitor_name: result.visit.visitor_name,
      house_label: `${result.house.block}-${result.house.house_number}`,
      registered_time: registeredAt,
      entry_time: null,
    })
    setSavingEntry(false)
    toast.success('Ingreso registrado correctamente')
    signal('entry_success')
  }

  useEffect(() => {
    if (token) {
      void Promise.resolve().then(validateToken)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [])

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-6 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-sm flex-col justify-between gap-5">
          <section className="rounded-2xl bg-white/10 p-6 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Garita
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight">
              Escanear QR
            </h1>
            <p className="mt-4 text-lg font-bold text-slate-200">
              Apunte la cámara al código QR del visitante
            </p>
          </section>

          <section className="min-h-[58vh] overflow-hidden rounded-2xl bg-black shadow-2xl">
            <div
              id="gate-qr-reader"
              className="flex min-h-[58vh] items-center justify-center text-center text-sm font-semibold text-slate-400"
            >
              {!cameraOpen && 'La cámara se mostrará aquí.'}
            </div>
          </section>

          <button
            type="button"
            onClick={handleOpenCamera}
            disabled={startingCamera || cameraOpen}
            className="min-h-20 w-full rounded-2xl bg-white px-4 py-5 text-2xl font-black text-slate-950 shadow-xl disabled:opacity-60 active:scale-[0.99]"
          >
            {startingCamera
              ? 'Abriendo cámara...'
              : cameraOpen
                ? 'Cámara activa'
                : 'Abrir cámara'}
          </button>

          {cameraOpen && (
            <button
              type="button"
              onClick={() => void stopScanner()}
              className="min-h-16 w-full rounded-2xl bg-red-600 px-4 py-4 text-xl font-black text-white shadow-xl active:scale-[0.99]"
            >
              Cerrar cámara
            </button>
          )}
        </div>
      </main>
    )
  }

  if (result.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-6 text-white">
        <section className="w-full max-w-sm rounded-2xl bg-white/10 p-6 text-center">
          <p className="text-sm font-semibold text-slate-300">Garita</p>
          <h1 className="mt-2 text-3xl font-black">Validando QR...</h1>
        </section>
      </main>
    )
  }

  if (result.status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-red-950 px-5 py-6 text-white">
        <section className="w-full max-w-sm rounded-2xl bg-red-600 p-6 text-center shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-100">
            Acceso denegado
          </p>
          <h1 className="mt-4 text-5xl font-black leading-tight">
            {result.title}
          </h1>
          <button
            type="button"
            onClick={() => void validateToken()}
            className="mt-8 min-h-14 w-full rounded-2xl bg-white px-4 py-4 text-lg font-black text-red-700 active:scale-[0.99]"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="mt-3 block min-h-14 w-full rounded-2xl border border-white/40 px-4 py-4 text-center text-lg font-black text-white active:scale-[0.99]"
          >
            Volver al dashboard
          </Link>
        </section>
      </main>
    )
  }

  if (registeredEntry) {
    const registeredTimeLabel = new Intl.DateTimeFormat('es-HN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(registeredEntry.registered_time))
    const entryTimeLabel = registeredEntry.entry_time
      ? new Intl.DateTimeFormat('es-HN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date(registeredEntry.entry_time))
      : null
    const isExit = registeredEntry.action === 'exit'

    return (
      <main
        className={`flex min-h-screen items-center justify-center px-5 py-6 text-white ${
          isExit ? 'bg-orange-950' : 'bg-green-950'
        }`}
      >
        <section
          className={`w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl ${
            isExit
              ? 'bg-orange-500 text-orange-950'
              : 'bg-green-500 text-green-950'
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-wide">
            Control de acceso
          </p>
          <h1 className="mt-4 text-5xl font-black leading-tight">
            {isExit ? 'SALIDA REGISTRADA' : 'INGRESO REGISTRADO'}
          </h1>
          <div className="mt-6 space-y-3 rounded-2xl bg-white p-5 text-left">
            <Detail label="Visitante" value={registeredEntry.visitor_name} />
            <Detail label="Casa" value={registeredEntry.house_label} />
            {isExit && entryTimeLabel && (
              <Detail label="Hora de entrada" value={entryTimeLabel} />
            )}
            <Detail
              label={isExit ? 'Hora de salida' : 'Hora de entrada'}
              value={registeredTimeLabel}
            />
          </div>
          <Link
            href="/dashboard"
            className={`mt-5 block min-h-14 w-full rounded-2xl px-4 py-4 text-center text-lg font-black text-white active:scale-[0.99] ${
              isExit ? 'bg-orange-950' : 'bg-green-950'
            }`}
          >
            Volver al dashboard
          </Link>
        </section>
      </main>
    )
  }

  const validUntil = new Date(result.visit.valid_until)
  const validUntilLabel = new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(validUntil)
  const openEntryTimeLabel = openEntry
    ? new Intl.DateTimeFormat('es-HN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(openEntry.entry_time))
    : null

  return (
    <main className="min-h-screen bg-green-950 px-5 py-6 text-white">
      <div className="mx-auto max-w-sm space-y-5">
        <section className="rounded-2xl bg-green-500 p-6 text-center shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-950">
            Validación garita
          </p>
          <h1 className="mt-4 text-5xl font-black leading-tight text-green-950">
            {openEntry ? 'VISITANTE DENTRO' : 'ACCESO AUTORIZADO'}
          </h1>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-6 text-slate-950 shadow-xl">
          <Detail label="Visitante" value={result.visit.visitor_name} />
          <Detail
            label="Casa"
            value={`${result.house.block}-${result.house.house_number}`}
          />
          <Detail label="Residencial" value={result.residential.name} />
          <Detail
            label="Tipo de visita"
            value={visitTypeLabels[result.visit.visit_type]}
          />
          <Detail
            label="Tipo de acceso"
            value={
              result.visit.access_mode === 'multi_use'
                ? 'Múltiples ingresos'
                : 'Un solo ingreso'
            }
          />
          <Detail label="Válido hasta" value={validUntilLabel} />
          {openEntryTimeLabel && (
            <Detail label="Hora de entrada" value={openEntryTimeLabel} />
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 text-slate-950 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            ANUNCIADO POR
          </p>
          {result.announcedBy ? (
            <>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {result.announcedBy.first_name} {result.announcedBy.last_name}
              </p>
              {result.announcedBy.phone && (
                <p className="mt-1 text-lg font-bold text-slate-600">
                  {result.announcedBy.phone}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-2xl font-black text-slate-950">
              No disponible
            </p>
          )}
        </section>

        {!openEntry && (
          <section className="space-y-4 rounded-2xl bg-white p-6 text-slate-950 shadow-xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Evidencia fotogrÃ¡fica
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Capturas opcionales tomadas por garita.
              </p>
            </div>
            <EntryPhotoInput
              id="identity-photo"
              label="Foto identidad"
              file={entryPhotoFiles.identity}
              onChange={(fileList) =>
                handleEntryPhotoChange('identity', fileList)
              }
            />
            <EntryPhotoInput
              id="vehicle-photo"
              label="Foto vehÃ­culo"
              file={entryPhotoFiles.vehicle}
              onChange={(fileList) =>
                handleEntryPhotoChange('vehicle', fileList)
              }
            />
            <EntryPhotoInput
              id="plate-photo"
              label="Foto placa"
              file={entryPhotoFiles.plate}
              onChange={(fileList) => handleEntryPhotoChange('plate', fileList)}
            />
          </section>
        )}

        <button
          type="button"
          onClick={handleRegisterAccess}
          disabled={savingEntry}
          className="min-h-14 w-full rounded-2xl bg-white px-4 py-4 text-lg font-black text-green-800 shadow-xl disabled:opacity-60 active:scale-[0.99]"
        >
          {savingEntry
            ? 'Registrando...'
            : openEntry
              ? 'Registrar salida'
              : 'Registrar ingreso'}
        </button>
        <Link
          href="/dashboard"
          className="block min-h-14 w-full rounded-2xl border border-white/30 px-4 py-4 text-center text-lg font-black text-white active:scale-[0.99]"
        >
          Volver al dashboard
        </Link>
      </div>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
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
    <div className="rounded-2xl bg-slate-50 p-4">
      <label
        htmlFor={id}
        className="block text-sm font-black text-slate-950"
      >
        {label}
      </label>
      <p className="mt-1 text-sm font-semibold text-slate-500">Opcional</p>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => onChange(event.target.files)}
        className="mt-3 block w-full text-sm font-semibold text-slate-700 file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-3 file:font-black file:text-white"
      />
      {file && (
        <p className="mt-2 break-words text-sm font-semibold text-slate-600">
          {file.name}
        </p>
      )}
    </div>
  )
}
