'use client'

import { useEffect, useRef, useState } from 'react'
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
  visitor_name: string
  house_label: string
  entry_time: string
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
    }

const visitTypeLabels: Record<Visit['visit_type'], string> = {
  family: 'Familiar',
  delivery: 'Delivery',
  service: 'Servicio',
  provider: 'Proveedor',
  other: 'Otro',
}

export default function GateScanPage() {
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
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannedRef = useRef(false)

  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }

  const setErrorResult = (title: string) => {
    setResult({ status: 'error', title })
    vibrate([180, 80, 180])
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
            vibrate([180, 80, 180])
            toast.error('QR no válido')
            return
          }

          scannedRef.current = true
          vibrate(80)
          void stopScanner().then(() => {
            router.push(`/gate/scan?token=${encodeURIComponent(scannedToken)}`)
          })
        },
        () => {}
      )
    } catch (error) {
      console.error('Error opening QR scanner:', error)
      toast.error('No se pudo abrir la cámara')
      setCameraOpen(false)
    } finally {
      setStartingCamera(false)
    }
  }

  const validateToken = async () => {
    setResult({ status: 'loading' })
    setRegisteredEntry(null)

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
        'id,residential_id,house_id,created_by,visitor_name,visit_type,valid_until,status'
      )
      .eq('id', qrToken.visit_id)
      .single()

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

    setResult({
      status: 'success',
      qrToken,
      visit,
      house,
      residential: residentialData as Residential,
      announcedBy: (announcedByData as AnnouncedBy | null) || null,
    })
    vibrate(80)
  }

  const handleRegisterEntry = async () => {
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

    const { error: entryError } = await supabase.from('visitor_entries').insert({
      residential_id: result.visit.residential_id,
      visit_id: result.visit.id,
      qr_token_id: result.qrToken.id,
      house_id: result.visit.house_id,
      guard_id: guardProfile.id,
      entry_status: 'allowed',
      notes: null,
    })

    if (entryError) {
      console.error('Error registering visitor entry:', entryError)
      toast.error(entryError.message)
      setSavingEntry(false)
      return
    }

    const usedAt = new Date().toISOString()

    const { error: qrTokenUpdateError } = await supabase
      .from('qr_tokens')
      .update({
        status: 'used',
        used_at: usedAt,
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

    setRegisteredEntry({
      visitor_name: result.visit.visitor_name,
      house_label: `${result.house.block}-${result.house.house_number}`,
      entry_time: usedAt,
    })
    setSavingEntry(false)
    toast.success('Ingreso registrado correctamente')
    vibrate(80)
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
          <section className="rounded-3xl bg-white/10 p-6 text-center shadow-2xl">
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

          <section className="min-h-[58vh] overflow-hidden rounded-3xl bg-black shadow-2xl">
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
            className="min-h-16 w-full rounded-2xl bg-white px-4 py-4 text-xl font-black text-slate-950 shadow-xl disabled:opacity-60 active:scale-[0.99]"
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
              className="min-h-14 w-full rounded-2xl border border-white/30 px-4 py-4 text-lg font-black text-white active:scale-[0.99]"
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
        <section className="w-full max-w-sm rounded-3xl bg-white/10 p-6 text-center">
          <p className="text-sm font-semibold text-slate-300">Garita</p>
          <h1 className="mt-2 text-3xl font-black">Validando QR...</h1>
        </section>
      </main>
    )
  }

  if (result.status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-red-950 px-5 py-6 text-white">
        <section className="w-full max-w-sm rounded-3xl bg-red-600 p-6 text-center shadow-2xl">
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
        </section>
      </main>
    )
  }

  if (registeredEntry) {
    const entryTimeLabel = new Intl.DateTimeFormat('es-HN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(registeredEntry.entry_time))

    return (
      <main className="flex min-h-screen items-center justify-center bg-green-950 px-5 py-6 text-white">
        <section className="w-full max-w-sm rounded-3xl bg-green-500 p-6 text-center text-green-950 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide">
            Control de acceso
          </p>
          <h1 className="mt-4 text-5xl font-black leading-tight">
            INGRESO REGISTRADO
          </h1>
          <div className="mt-6 space-y-3 rounded-2xl bg-white p-5 text-left">
            <Detail label="Visitante" value={registeredEntry.visitor_name} />
            <Detail label="Casa" value={registeredEntry.house_label} />
            <Detail label="Hora" value={entryTimeLabel} />
          </div>
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

  return (
    <main className="min-h-screen bg-green-950 px-5 py-6 text-white">
      <div className="mx-auto max-w-sm space-y-5">
        <section className="rounded-3xl bg-green-500 p-6 text-center shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-950">
            Validación garita
          </p>
          <h1 className="mt-4 text-5xl font-black leading-tight text-green-950">
            ACCESO AUTORIZADO
          </h1>
        </section>

        <section className="space-y-4 rounded-3xl bg-white p-6 text-slate-950 shadow-xl">
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
          <Detail label="Válido hasta" value={validUntilLabel} />
        </section>

        <section className="rounded-3xl bg-white p-6 text-slate-950 shadow-xl">
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

        <button
          type="button"
          onClick={handleRegisterEntry}
          disabled={savingEntry}
          className="min-h-14 w-full rounded-2xl bg-white px-4 py-4 text-lg font-black text-green-800 shadow-xl disabled:opacity-60 active:scale-[0.99]"
        >
          {savingEntry ? 'Registrando...' : 'Registrar ingreso'}
        </button>
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
