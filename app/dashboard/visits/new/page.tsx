'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { VisitQrCard } from '../VisitQrCard'
import { PageHeader } from '@/app/components/PageHeader'

type Profile = {
  id: string
  first_name: string
  last_name: string
  residential_id: string | null
  house_id: string | null
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
}

type VisitType = 'family' | 'delivery' | 'service' | 'provider' | 'other'
type AccessMode = 'single_use' | 'multi_use'

type VisitFormData = {
  visitor_name: string
  visitor_identity: string
  visit_type: VisitType
  access_mode: AccessMode
  valid_date: string
  valid_time: string
  notes: string
}

type CreatedVisit = {
  visitor_name: string
  access_mode: AccessMode
  created_at: string
  valid_until: string
  shareUrl: string
  qrDataUrl: string
  announcedBy: string
  residentialName: string
  houseLabel: string
}

const initialFormData: VisitFormData = {
  visitor_name: '',
  visitor_identity: '',
  visit_type: 'family',
  access_mode: 'single_use',
  valid_date: '',
  valid_time: '',
  notes: '',
}

const visitTypeOptions: { value: VisitType; label: string }[] = [
  { value: 'family', label: 'Familiar' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'service', label: 'Servicio' },
  { value: 'provider', label: 'Proveedor' },
  { value: 'other', label: 'Otro' },
]

const accessModeOptions: { value: AccessMode; label: string }[] = [
  { value: 'single_use', label: 'Un solo ingreso' },
  { value: 'multi_use', label: 'Múltiples ingresos hasta vencimiento' },
]

export default function NewVisitPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [housePaysecurity, setHousePaysecurity] = useState<boolean | null>(null)
  const [formData, setFormData] = useState<VisitFormData>(initialFormData)
  const [createdVisit, setCreatedVisit] = useState<CreatedVisit | null>(null)
  const [accessLabel, setAccessLabel] = useState('tu residencial/casa')
  const [residentialName, setResidentialName] = useState('Residencial')
  const [houseLabel, setHouseLabel] = useState('Casa')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadProfile = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesión para crear visitas')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,residential_id,house_id,role,status')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (error) {
      console.error('Error loading profile:', error)
      toast.error('No se pudo cargar tu perfil')
      setProfile(null)
      setLoading(false)
      return
    }

    setProfile(data)

    if (data.house_id) {
      const { data: houseData, error: houseError } = await supabase
        .from('houses')
        .select('residential_id,block,house_number,pays_security')
        .eq('id', data.house_id)
        .single()

      if (houseError || !houseData) {
        console.error('Error loading house for share label:', houseError)
      } else {
        setHousePaysecurity(houseData.pays_security ?? false)
        const { data: residentialData, error: residentialError } =
          await supabase
            .from('residentials')
            .select('name')
            .eq('id', houseData.residential_id)
            .single()

        if (residentialError || !residentialData) {
          console.error(
            'Error loading residential for share label:',
            residentialError,
          )
          setAccessLabel(`Casa ${houseData.block}-${houseData.house_number}`)
          setHouseLabel(`Casa ${houseData.block}-${houseData.house_number}`)
        } else {
          setAccessLabel(
            `${residentialData.name} / Casa ${houseData.block}-${houseData.house_number}`,
          )
          setResidentialName(residentialData.name)
          setHouseLabel(`Casa ${houseData.block}-${houseData.house_number}`)
        }
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadProfile)
  }, [])

  const canCreateVisit =
    profile?.status === 'approved' &&
    profile.role === 'resident' &&
    Boolean(profile.residential_id) &&
    Boolean(profile.house_id) &&
    housePaysecurity === true

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!profile || !canCreateVisit || !profile.residential_id || !profile.house_id) {
      toast.error('Tu perfil no está habilitado para crear visitas')
      return
    }

    if (!formData.valid_date || !formData.valid_time) {
      toast.error('Selecciona la fecha y hora de vencimiento')
      return
    }

    setSaving(true)

    const validUntil = new Date(`${formData.valid_date}T${formData.valid_time}`).toISOString()

    const { data: visitData, error: visitError } = await supabase
      .from('visits')
      .insert({
        residential_id: profile.residential_id,
        house_id: profile.house_id,
        created_by: profile.id,
        visitor_name: formData.visitor_name.trim(),
        visitor_identity: formData.visitor_identity.trim() || null,
        vehicle_plate: null,
        visit_type: formData.visit_type,
        access_mode: formData.access_mode,
        valid_from: new Date().toISOString(),
        valid_until: validUntil,
        status: 'active',
        notes: formData.notes.trim() || null,
      })
      .select('id,visitor_name,created_at,valid_until')
      .single()

    if (visitError || !visitData) {
      console.error('Error creating visit:', visitError)
      toast.error(visitError?.message || 'No se pudo crear la visita')
      setSaving(false)
      return
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from('qr_tokens')
      .insert({
        visit_id: visitData.id,
        residential_id: profile.residential_id,
        expires_at: validUntil,
        status: 'active',
      })
      .select('token')
      .single()

    if (tokenError || !tokenData) {
      console.error('Error creating QR token:', tokenError)
      toast.error(tokenError?.message || 'No se pudo generar el token QR')
      setSaving(false)
      return
    }

    const shareUrl = `${window.location.origin}/gate/scan?token=${tokenData.token}`
    let qrDataUrl = ''

    try {
      qrDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#020617',
          light: '#ffffff',
        },
      })
    } catch (error) {
      console.error('Error generating QR image:', error)
      toast.error('No se pudo generar la imagen QR')
      setSaving(false)
      return
    }

    setCreatedVisit({
      visitor_name: visitData.visitor_name,
      access_mode: formData.access_mode,
      created_at: visitData.created_at,
      valid_until: visitData.valid_until,
      shareUrl,
      qrDataUrl,
      announcedBy: `${profile.first_name} ${profile.last_name}`,
      residentialName,
      houseLabel,
    })
    setFormData(initialFormData)
    setSaving(false)
    toast.success('Visita creada correctamente')
  }

  const handleShare = async () => {
    if (!createdVisit) {
      return
    }

    const shareMessage = `Te comparto tu acceso a ${accessLabel}. Presenta este QR en garita: ${createdVisit.shareUrl}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Acceso residencial',
          text: shareMessage,
          url: createdVisit.shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(createdVisit.shareUrl)
        toast.success('Link copiado para compartir')
      }
    } catch (error) {
      console.error('Error sharing visit:', error)
      try {
        await navigator.clipboard.writeText(createdVisit.shareUrl)
        toast.success('Link copiado para compartir')
      } catch (clipboardError) {
        console.error('Error copying visit link:', clipboardError)
        toast.error('No se pudo compartir la visita')
      }
    }
  }

  const handleOpenWhatsApp = () => {
    if (!createdVisit) {
      return
    }

    const shareMessage = `Te comparto tu acceso a ${accessLabel}. Presenta este QR en garita: ${createdVisit.shareUrl}`
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
            <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
          </section>
        </div>
      </main>
    )
  }

  if (!canCreateVisit) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Nueva visita</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            Acceso no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {profile?.status === 'approved' &&
            profile.role === 'resident' &&
            profile.house_id &&
            housePaysecurity === false
              ? 'Tu casa no tiene seguridad activa. Contacta a la administración de tu residencial.'
              : 'Tu perfil debe estar aprobado como residente y tener una casa asignada para generar visitas.'}
          </p>
          <Link
            href="/dashboard"
            className="mt-6 block min-h-12 rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 text-center font-semibold text-white active:scale-[0.99]"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    )
  }

  if (createdVisit) {
    const expiresAt = new Date(createdVisit.valid_until)
    const expiresLabel = new Intl.DateTimeFormat('es-HN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(expiresAt)

    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <PageHeader title="Visita creada" backHref="/dashboard/visits" />

          <section className="rounded-2xl bg-green-600 p-6 text-white shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-green-100">
                Acceso generado correctamente
              </p>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                🟢 Activo
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold">
              {createdVisit.visitor_name}
            </h1>
            <div className="mt-5 rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-green-50">Válido hasta:</p>
              <p className="mt-1 text-lg font-bold">{expiresLabel}</p>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
            <VisitQrCard
              qrDataUrl={createdVisit.qrDataUrl}
              qrScanUrl={createdVisit.shareUrl}
              visitorName={createdVisit.visitor_name}
              announcedBy={createdVisit.announcedBy}
              accessMode={createdVisit.access_mode}
              createdAt={createdVisit.created_at}
              validUntil={createdVisit.valid_until}
              residentialName={createdVisit.residentialName}
              houseLabel={createdVisit.houseLabel}
            />

            <button
              type="button"
              onClick={handleShare}
              className="min-h-12 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 font-semibold text-white active:scale-[0.99]"
            >
              Compartir por WhatsApp
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="min-h-12 w-full rounded-2xl border border-green-200 dark:border-green-800 px-4 py-3 font-semibold text-green-700 dark:text-green-400 active:scale-[0.99]"
            >
              Abrir WhatsApp
            </button>

            <button
              type="button"
              onClick={() => setCreatedVisit(null)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-600 px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 active:scale-[0.99]"
            >
              Crear otra visita
            </button>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <PageHeader title="Nueva visita" subtitle="Genera un QR de acceso para tu visitante" />

        <form
          onSubmit={handleCreateVisit}
          className="space-y-4 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm"
        >
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Nombre del visitante
            </span>
            <input
              value={formData.visitor_name}
              onChange={(e) =>
                setFormData({ ...formData, visitor_name: e.target.value })
              }
              placeholder="Ej: Juan Pérez"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Identidad del visitante (opcional)
            </span>
            <input
              value={formData.visitor_identity}
              onChange={(e) =>
                setFormData({ ...formData, visitor_identity: e.target.value })
              }
              placeholder="Opcional"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Tipo de visita
            </span>
            <select
              value={formData.visit_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  visit_type: e.target.value as VisitType,
                })
              }
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
            >
              {visitTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Tipo de acceso
            </span>
            <select
              value={formData.access_mode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  access_mode: e.target.value as AccessMode,
                })
              }
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
            >
              {accessModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              Un solo ingreso se invalida al registrar entrada. Múltiples
              ingresos permite entrada/salida hasta la fecha de vencimiento.
            </p>
          </label>

          <div className="space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Válido hasta
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Fecha
                </label>
                <input
                  value={formData.valid_date}
                  onChange={(e) =>
                    setFormData({ ...formData, valid_date: e.target.value })
                  }
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Hora
                </label>
                <input
                  value={formData.valid_time}
                  onChange={(e) =>
                    setFormData({ ...formData, valid_time: e.target.value })
                  }
                  type="time"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
                  required
                />
              </div>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notas</span>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Opcional"
              className="min-h-24 w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-4 py-3 text-sm outline-none"
            />
          </label>

          <p className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
            El guardia podrá tomar fotografía del vehículo, placa e identidad al
            momento del ingreso.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="min-h-12 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
          >
            {saving ? 'Generando...' : 'Generar token QR'}
          </button>
        </form>
      </div>
    </main>
  )
}
