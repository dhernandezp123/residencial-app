'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Camera, CheckCircle, ArrowRightLeft } from 'lucide-react'
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

const maxEntryPhotoSizeBytes = 8 * 1024 * 1024

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
  const [cameraOpen, setCameraOpen] = useState(false)
  const [startingCamera, setStartingCamera] = useState(false)
  const [confirmingExit, setConfirmingExit] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [entryPhotoFiles, setEntryPhotoFiles] = useState<EntryPhotoFiles>({
    identity: null,
    vehicle: null,
    plate: null,
  })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const scannedRef = useRef(false)

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }, [])

  const playBeep = useCallback((durationMs: number = 500, frequency: number = 880) => {
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
  }, [])

  type SignalType =
    | 'scan_success'
    | 'scan_error'
    | 'entry_success'
    | 'exit_success'

  const signal = useCallback((type: SignalType) => {
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
  }, [playBeep, vibrate])

  const setErrorResult = useCallback((title: string) => {
    setResult({ status: 'error', title })
    signal('scan_error')
  }, [signal])

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

  const stopScanner = useCallback(async () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraOpen(false)
  }, [])

  const handleOpenCamera = async () => {
    setStartingCamera(true)
    scannedRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })

      if (!videoRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        setStartingCamera(false)
        return
      }

      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraOpen(true)

      const { default: jsQR } = await import('jsqr')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      const tick = () => {
        const video = videoRef.current
        if (scannedRef.current || !video || !ctx) return

        if (video.readyState >= video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          })

          if (code?.data) {
            const scannedToken = extractTokenFromQr(code.data)
            if (scannedToken) {
              scannedRef.current = true
              signal('scan_success')
              void stopScanner().then(() => {
                router.push(`/gate/scan?token=${encodeURIComponent(scannedToken)}`)
              })
              return
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(tick)
      }

      animFrameRef.current = requestAnimationFrame(tick)
    } catch (error) {
      console.error('Error opening camera:', error)
      toast.error('No se pudo abrir la cámara. Asegúrate de permitir el acceso.')
      setCameraOpen(false)
    } finally {
      setStartingCamera(false)
    }
  }

  const validateToken = useCallback(async () => {
    setResult({ status: 'loading' })
    setRegisteredEntry(null)
    setConfirmingExit(false)
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

    const { data: visitData, error: visitError } = await supabase
      .from('visits')
      .select(
        'id,residential_id,house_id,created_by,visitor_name,visit_type,access_mode,valid_until,status'
      )
      .eq('id', qrToken.visit_id)
      .single()

    if (visitError || !visitData) {
      console.error('Error loading visit:', visitError)
      setErrorResult('QR inválido')
      return
    }

    const visit = visitData as Visit

    const [
      { data: houseData, error: houseError },
      { data: residentialData, error: residentialError },
      { data: announcedByData },
      { data: allowedEntriesData, error: allowedEntriesError },
    ] = await Promise.all([
      supabase
        .from('houses')
        .select('id,residential_id,block,house_number')
        .eq('id', visit.house_id)
        .single(),
      supabase
        .from('residentials')
        .select('id,name')
        .eq('id', visit.residential_id)
        .single(),
      supabase
        .from('profiles')
        .select('id,first_name,last_name,phone')
        .eq('id', visit.created_by)
        .single(),
      supabase
        .from('visitor_entries')
        .select('id,entry_time,exit_time')
        .eq('visit_id', visit.id)
        .eq('entry_status', 'allowed')
        .order('entry_time', { ascending: false }),
    ])

    if (houseError || !houseData) {
      console.error('Error loading house:', houseError)
      setErrorResult('QR inválido')
      return
    }

    if (residentialError || !residentialData) {
      console.error('Error loading residential:', residentialError)
      setErrorResult('QR inválido')
      return
    }

    if (allowedEntriesError) {
      console.error('Error loading visitor entries:', allowedEntriesError)
      toast.error(allowedEntriesError.message)
      setErrorResult('QR no disponible')
      return
    }

    const house = houseData as House
    const allowedEntries = (allowedEntriesData as OpenEntry[] | null) || []
    const currentOpenEntry =
      allowedEntries.find((entry) => entry.exit_time === null) || null

    if (
      visit.access_mode === 'single_use' &&
      allowedEntries.length > 0 &&
      !currentOpenEntry
    ) {
      setErrorResult('QR no disponible')
      return
    }

    if (visit.access_mode === 'multi_use' || !currentOpenEntry) {
      if (qrToken.status !== 'active') {
        setErrorResult('QR no disponible')
        return
      }

      if (new Date(qrToken.expires_at).getTime() <= Date.now()) {
        setErrorResult('QR vencido')
        return
      }

      if (visit.status !== 'active') {
        setErrorResult('QR no disponible')
        return
      }
    }

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
  }, [setErrorResult, signal, token])

  const handleEntryPhotoChange = (
    kind: EntryPhotoKind,
    fileList: FileList | null,
  ) => {
    const selectedFile = fileList?.[0] || null

    if (selectedFile && selectedFile.size > maxEntryPhotoSizeBytes) {
      toast.error('La foto debe pesar menos de 8 MB')
      setEntryPhotoFiles((currentFiles) => ({
        ...currentFiles,
        [kind]: null,
      }))
      return
    }

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
    if (savingEntry || result.status !== 'success') {
      return
    }

    const currentOpenEntry = result.openEntry

    if (currentOpenEntry && !confirmingExit) {
      setConfirmingExit(true)
      toast.message('Confirma la salida tocando el botón nuevamente')
      return
    }

    if (
      !currentOpenEntry &&
      (!entryPhotoFiles.identity ||
        !entryPhotoFiles.vehicle ||
        !entryPhotoFiles.plate)
    ) {
      toast.error(
        'Debes tomar foto de identidad, vehículo y placa antes de registrar ingreso',
      )
      return
    }

    setSavingEntry(true)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      toast.error('Sesión no disponible')
      setSavingEntry(false)
      return
    }

    let identityPhotoUrl: string | null = null
    let vehiclePhotoUrl: string | null = null
    let platePhotoUrl: string | null = null

    if (!currentOpenEntry) {
      try {
        setUploadStatus('Subiendo identidad (1/3)...')
        identityPhotoUrl = await uploadEntryPhoto({
          kind: 'identity',
          bucket: 'visitor-identities',
          file: entryPhotoFiles.identity,
        })
        setUploadStatus('Subiendo vehículo (2/3)...')
        vehiclePhotoUrl = await uploadEntryPhoto({
          kind: 'vehicle',
          bucket: 'visitor-vehicles',
          file: entryPhotoFiles.vehicle,
        })
        setUploadStatus('Subiendo placa (3/3)...')
        platePhotoUrl = await uploadEntryPhoto({
          kind: 'plate',
          bucket: 'visitor-plates',
          file: entryPhotoFiles.plate,
        })
        setUploadStatus(null)
      } catch (error) {
        console.error('Error uploading entry photo:', error)
        setUploadStatus(null)
        toast.error(
          error instanceof Error
            ? error.message
            : 'No se pudo subir la evidencia fotográfica',
        )
        setSavingEntry(false)
        return
      }
    }

    let apiResponse: {
      action: 'entry' | 'exit'
      entry: { id: string; entry_time: string; exit_time: string | null }
    }

    try {
      const response = await fetch('/api/gate/register-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          token,
          identity_photo_url: identityPhotoUrl,
          vehicle_photo_url: vehiclePhotoUrl,
          plate_photo_url: platePhotoUrl,
        }),
      })

      const data = (await response.json()) as {
        action?: 'entry' | 'exit'
        entry?: { id: string; entry_time: string; exit_time: string | null }
        error?: string
      }

      if (!response.ok) {
        toast.error(data.error ?? 'Error al registrar acceso')
        setSavingEntry(false)
        return
      }

      if (!data.action || !data.entry) {
        toast.error('Respuesta inesperada del servidor')
        setSavingEntry(false)
        return
      }

      apiResponse = { action: data.action, entry: data.entry }
    } catch (error) {
      console.error('Error calling register-access:', error)
      toast.error('No se pudo conectar con el servidor')
      setSavingEntry(false)
      return
    }

    if (apiResponse.action === 'exit') {
      setRegisteredEntry({
        action: 'exit',
        visitor_name: result.visit.visitor_name,
        house_label: `${result.house.block}-${result.house.house_number}`,
        registered_time: apiResponse.entry.exit_time ?? new Date().toISOString(),
        entry_time: currentOpenEntry?.entry_time ?? null,
      })
      setSavingEntry(false)
      toast.success('Salida registrada')
      signal('exit_success')
      return
    }

    setRegisteredEntry({
      action: 'entry',
      visitor_name: result.visit.visitor_name,
      house_label: `${result.house.block}-${result.house.house_number}`,
      registered_time: apiResponse.entry.entry_time,
      entry_time: null,
    })
    setSavingEntry(false)
    toast.success('Acceso registrado')
    signal('entry_success')
  }

  useEffect(() => {
    if (!token) {
      return
    }

    const validationTimer = window.setTimeout(() => {
      void validateToken()
    }, 0)

    return () => window.clearTimeout(validationTimer)
  }, [token, validateToken])

  useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [stopScanner])

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
            <div className="relative flex min-h-[58vh] items-center justify-center">
              {!cameraOpen && (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <Camera className="h-20 w-20 text-slate-600" />
                  <p className="text-base font-semibold text-slate-400">
                    Toca el botón para abrir la cámara y escanear el QR del visitante
                  </p>
                </div>
              )}
              {/* playsInline es obligatorio en iOS para evitar fullscreen */}
              <video
                ref={videoRef}
                className={`h-full w-full object-cover ${cameraOpen ? 'block' : 'hidden'}`}
                playsInline
                muted
                autoPlay
              />
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
          isExit ? 'bg-blue-950' : 'bg-green-950'
        }`}
      >
        <section
          className={`w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl ${
            isExit
              ? 'bg-blue-500 text-blue-950'
              : 'bg-green-500 text-green-950'
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-wide">
            Control de acceso
          </p>
          {isExit ? (
            <ArrowRightLeft className="mx-auto mt-4 h-16 w-16" />
          ) : (
            <CheckCircle className="mx-auto mt-4 h-16 w-16" />
          )}
          <h1 className="mt-3 text-4xl font-black leading-tight">
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
            href="/gate/scan"
            className={`mt-5 block min-h-14 w-full rounded-2xl px-4 py-4 text-center text-lg font-black text-white active:scale-[0.99] ${
              isExit ? 'bg-blue-950' : 'bg-green-950'
            }`}
          >
            Escanear otro QR
          </Link>
          <Link
            href="/dashboard"
            className="mt-3 block min-h-14 w-full rounded-2xl border border-current px-4 py-4 text-center text-lg font-black opacity-70 active:scale-[0.99]"
          >
            Volver al dashboard
          </Link>
        </section>
      </main>
    )
  }

  const openEntry = result.openEntry
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

        {openEntry && confirmingExit && (
          <section className="rounded-2xl bg-orange-100 p-5 text-orange-950 shadow-xl">
            <p className="text-sm font-black uppercase tracking-wide">
              Confirmar salida
            </p>
            <p className="mt-2 text-base font-semibold">
              Toca nuevamente el botón para registrar la salida del visitante.
            </p>
          </section>
        )}

        {!openEntry && (
          <section className="space-y-4 rounded-2xl bg-white p-6 text-slate-950 shadow-xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Evidencia fotográfica
              </p>
              <p className="mt-1 text-base font-black text-slate-950">
                Evidencia requerida:
              </p>
              <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
                <li>Identidad</li>
                <li>Vehículo</li>
                <li>Placa</li>
              </ul>
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
              label="Foto vehículo"
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
          className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-lg font-black shadow-xl transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] ${
            confirmingExit
              ? 'bg-orange-500 text-orange-950'
              : 'bg-white text-green-800'
          }`}
        >
          {savingEntry ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              {uploadStatus ?? 'Registrando...'}
            </>
          ) : openEntry ? (
            confirmingExit ? (
              'Confirmar salida'
            ) : (
              'Registrar salida'
            )
          ) : (
            'Registrar ingreso'
          )}
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
      <p className="mt-1 text-sm font-semibold text-slate-500">Requerida</p>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => onChange(event.target.files)}
        className="mt-3 block w-full text-sm font-semibold text-slate-700 file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-3 file:font-black file:text-white"
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
