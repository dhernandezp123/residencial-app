'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
type VisitMode = 'visit' | 'delivery'

type VisitFormData = {
  visitor_name: string
  visitor_identity: string
  visit_type: VisitType
  access_mode: AccessMode
  valid_until: string
  companions: number
  frequent_visit: boolean
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

function toLocalDateTimeInput(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function buildInitialFormData(mode: VisitMode): VisitFormData {
  const expiration = new Date()
  expiration.setHours(expiration.getHours() + (mode === 'delivery' ? 2 : 8))

  return {
    visitor_name: '',
    visitor_identity: '',
    visit_type: mode === 'delivery' ? 'delivery' : 'family',
    access_mode: 'single_use',
    valid_until: toLocalDateTimeInput(expiration),
    companions: 0,
    frequent_visit: false,
    notes: '',
  }
}

function buildNotes(formData: VisitFormData) {
  const notesParts = [
    formData.notes.trim(),
    formData.companions > 0 ? `Acompañantes: ${formData.companions}` : '',
    formData.frequent_visit ? 'Visita frecuente' : '',
  ].filter(Boolean)

  return notesParts.length > 0 ? notesParts.join('\n') : null
}

function NewVisitLoading() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
      <div className="mx-auto max-w-sm space-y-5">
        <div className="h-5 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="mt-4 h-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="mt-3 h-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="mt-3 h-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
        </section>
      </div>
    </main>
  )
}

export default function NewVisitPage() {
  return (
    <Suspense fallback={<NewVisitLoading />}>
      <NewVisitContent />
    </Suspense>
  )
}

function NewVisitContent() {
  const searchParams = useSearchParams()
  const mode: VisitMode =
    searchParams.get('mode') === 'delivery' ? 'delivery' : 'visit'
  const isDeliveryMode = mode === 'delivery'
  const [profile, setProfile] = useState<Profile | null>(null)
  const [housePaysecurity, setHousePaysecurity] = useState<boolean | null>(null)
  const [houseIsActive, setHouseIsActive] = useState<boolean | null>(null)
  const [formData, setFormData] = useState<VisitFormData>(() =>
    buildInitialFormData(mode),
  )
  const [createdVisit, setCreatedVisit] = useState<CreatedVisit | null>(null)
  const [residentialName, setResidentialName] = useState('Residencial')
  const [houseLabel, setHouseLabel] = useState('Casa')
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
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
          .select('residential_id,block,house_number,pays_security,is_active')
          .eq('id', data.house_id)
          .single()

        if (houseError || !houseData) {
          console.error('Error loading house for share label:', houseError)
        } else {
          setHousePaysecurity(houseData.pays_security ?? false)
          setHouseIsActive(houseData.is_active ?? false)

          const { data: residentialData, error: residentialError } =
            await supabase
              .from('residentials')
              .select('name')
              .eq('id', houseData.residential_id)
              .single()

          setHouseLabel(`Casa ${houseData.block}-${houseData.house_number}`)

          if (residentialError || !residentialData) {
            console.error(
              'Error loading residential for share label:',
              residentialError,
            )
          } else {
            setResidentialName(residentialData.name)
          }
        }
      }

      setLoading(false)
    }

    void loadProfile()
  }, [])

  const canCreateVisit =
    profile?.status === 'approved' &&
    profile.role === 'resident' &&
    Boolean(profile.residential_id) &&
    Boolean(profile.house_id) &&
    houseIsActive === true &&
    housePaysecurity === true

  const handleCopyLink = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copiado')
    } catch (error) {
      console.error('Error copying invitation link:', error)
      toast.error('No se pudo copiar el link')
    }
  }

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !profile ||
      !canCreateVisit ||
      !profile.residential_id ||
      !profile.house_id
    ) {
      toast.error('Tu perfil no está habilitado para crear visitas')
      return
    }

    if (!formData.valid_until) {
      toast.error('Selecciona la fecha y hora de vencimiento')
      return
    }

    const validUntilDate = new Date(formData.valid_until)

    if (Number.isNaN(validUntilDate.getTime()) || validUntilDate <= new Date()) {
      toast.error('El vencimiento debe ser una fecha futura')
      return
    }

    setSaving(true)

    const validUntil = validUntilDate.toISOString()

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
        notes: buildNotes(formData),
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
    setFormData(buildInitialFormData(mode))
    setMoreOptionsOpen(false)
    setSaving(false)
    toast.success('Visita creada correctamente')
  }

  if (loading) {
    return <NewVisitLoading />
  }

  if (!canCreateVisit) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {isDeliveryMode ? 'Nuevo delivery' : 'Nueva visita'}
          </p>
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
            className="mt-6 block min-h-12 rounded-2xl bg-slate-950 px-4 py-3 text-center font-semibold text-white active:scale-[0.99] dark:bg-slate-700"
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
      <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
        <div className="mx-auto max-w-sm space-y-5">
          <PageHeader title="Visita creada" backHref="/dashboard/visits" />

          <section className="rounded-2xl bg-green-600 p-6 text-white shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-green-100">
                Acceso generado correctamente
              </p>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                Activo
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

          <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
            <VisitQrCard
              qrDataUrl={createdVisit.qrDataUrl}
              visitorName={createdVisit.visitor_name}
              announcedBy={createdVisit.announcedBy}
              accessMode={createdVisit.access_mode}
              createdAt={createdVisit.created_at}
              validUntil={createdVisit.valid_until}
              residentialName={createdVisit.residentialName}
              houseLabel={createdVisit.houseLabel}
            />

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-700/50">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Link de respaldo
              </p>
              <p className="mt-1 break-all text-xs leading-5 text-slate-500 dark:text-slate-300">
                {createdVisit.shareUrl}
              </p>
              <button
                type="button"
                onClick={() => void handleCopyLink(createdVisit.shareUrl)}
                className="mt-3 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-800 active:scale-[0.99] dark:border-slate-600 dark:text-slate-200"
              >
                Copiar link
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCreatedVisit(null)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-800 active:scale-[0.99] dark:border-slate-600 dark:text-slate-200"
            >
              Crear otra visita
            </button>
            <Link
              href="/dashboard"
              className="block min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 text-center font-semibold text-white active:scale-[0.99] dark:bg-slate-700"
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
          title={isDeliveryMode ? 'Nuevo delivery' : 'Nueva visita'}
          subtitle="Genera un QR de acceso"
        />

        <form
          onSubmit={handleCreateVisit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800"
        >
          {isDeliveryMode && (
            <p className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100">
              Ideal para comida, paquetes o entregas rápidas. El vencimiento
              recomendado es de 2 horas.
            </p>
          )}

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Nombre visitante/proveedor
            </span>
            <input
              value={formData.visitor_name}
              onChange={(e) =>
                setFormData({ ...formData, visitor_name: e.target.value })
              }
              placeholder="Ej: Juan Pérez"
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
              min={toLocalDateTimeInput(new Date())}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              required
            />
          </label>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-600">
            <button
              type="button"
              onClick={() => setMoreOptionsOpen((current) => !current)}
              className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left font-semibold text-slate-800 dark:text-slate-100"
            >
              <span>Más opciones</span>
              <span className="text-lg text-slate-400">
                {moreOptionsOpen ? '-' : '+'}
              </span>
            </button>

            {moreOptionsOpen && (
              <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-600">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Tipo de autorización
                  </span>
                  <select
                    value={formData.access_mode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        access_mode: e.target.value as AccessMode,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    {accessModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Un solo ingreso se invalida al registrar entrada.
                  </p>
                </label>

                {!isDeliveryMode && (
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
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      {visitTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Número de acompañantes
                  </span>
                  <input
                    value={formData.companions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        companions: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </label>

                <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-700/50">
                  <input
                    checked={formData.frequent_visit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        frequent_visit: e.target.checked,
                      })
                    }
                    type="checkbox"
                    className="h-5 w-5 rounded border-slate-300"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Visita frecuente
                  </span>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Comentario adicional
                  </span>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </label>
              </div>
            )}
          </div>

          <p className="rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
            El guardia podrá tomar fotografía del vehículo, placa e identidad al
            momento del ingreso.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white active:scale-[0.99] disabled:opacity-60 dark:bg-slate-700"
          >
            {saving ? 'Creando...' : 'Crear visita e invitar'}
          </button>
        </form>
      </div>
    </main>
  )
}
