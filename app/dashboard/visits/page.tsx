'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { VisitQrCard } from './VisitQrCard'

type Profile = {
  id: string
  first_name: string
  last_name: string
  residential_id: string | null
  house_id: string | null
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
}

type VisitStatus = 'active' | 'used' | 'expired' | 'cancelled'

type VisitType = 'family' | 'delivery' | 'service' | 'provider' | 'other'
type AccessMode = 'single_use' | 'multi_use'

type Visit = {
  id: string
  visitor_name: string
  visit_type: VisitType
  access_mode: AccessMode
  valid_until: string
  status: VisitStatus
  created_at: string
}

type QrToken = {
  id: string
  visit_id: string
  token: string
  status: VisitStatus
  expires_at: string
}

type VisitWithToken = Visit & {
  qrToken: QrToken | null
}

const visitTypeLabels: Record<VisitType, string> = {
  family: 'Familiar',
  delivery: 'Delivery',
  service: 'Servicio',
  provider: 'Proveedor',
  other: 'Otro',
}

const statusLabels: Record<VisitStatus, string> = {
  active: 'Activa',
  used: 'Usada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
}

const statusStyles: Record<VisitStatus, string> = {
  active: 'bg-green-100 text-green-800',
  used: 'bg-slate-100 text-slate-700',
  expired: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function VisitsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [visits, setVisits] = useState<VisitWithToken[]>([])
  const [residentialName, setResidentialName] = useState('Residencial')
  const [houseLabel, setHouseLabel] = useState('Casa')
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [qrImagesByVisitId, setQrImagesByVisitId] = useState<
    Record<string, string>
  >({})

  const loadVisits = useCallback(async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesión para ver tus visitas')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,residential_id,house_id,role,status')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError || !profileData) {
      console.error('Error loading profile:', profileError)
      toast.error('No se pudo cargar tu perfil')
      setLoading(false)
      return
    }

    setProfile(profileData)

    if (profileData.house_id) {
      const { data: houseData, error: houseError } = await supabase
        .from('houses')
        .select('residential_id,block,house_number')
        .eq('id', profileData.house_id)
        .single()

      if (houseError || !houseData) {
        console.error('Error loading resident house:', houseError)
      } else {
        setHouseLabel(`Casa ${houseData.block}-${houseData.house_number}`)

        const { data: residentialData, error: residentialError } =
          await supabase
            .from('residentials')
            .select('name')
            .eq('id', houseData.residential_id)
            .single()

        if (residentialError || !residentialData) {
          console.error('Error loading resident residential:', residentialError)
        } else {
          setResidentialName(residentialData.name)
        }
      }
    }

    if (
      profileData.role !== 'resident' ||
      profileData.status !== 'approved'
    ) {
      setVisits([])
      setLoading(false)
      return
    }

    const { data: visitsData, error: visitsError } = await supabase
      .from('visits')
      .select('id,visitor_name,visit_type,access_mode,valid_until,status,created_at')
      .eq('created_by', profileData.id)
      .order('created_at', { ascending: false })

    if (visitsError) {
      console.error('Error loading visits:', visitsError)
      toast.error('No se pudieron cargar tus visitas')
      setLoading(false)
      return
    }

    const loadedVisits = (visitsData || []) as Visit[]
    const visitIds = loadedVisits.map((visit) => visit.id)
    let tokensByVisitId: Record<string, QrToken> = {}

    if (visitIds.length > 0) {
      const { data: tokensData, error: tokensError } = await supabase
        .from('qr_tokens')
        .select('id,visit_id,token,status,expires_at,created_at')
        .in('visit_id', visitIds)
        .order('created_at', { ascending: false })

      if (tokensError) {
        console.error('Error loading QR tokens:', tokensError)
        toast.error('No se pudieron cargar los códigos QR')
      } else {
        tokensByVisitId = ((tokensData || []) as QrToken[]).reduce<
          Record<string, QrToken>
        >((accumulator, token) => {
          if (!accumulator[token.visit_id]) {
            accumulator[token.visit_id] = token
          }

          return accumulator
        }, {})
      }
    }

    setVisits(
      loadedVisits.map((visit) => ({
        ...visit,
        qrToken: tokensByVisitId[visit.id] || null,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadVisits)
  }, [loadVisits])

  const canViewVisits = useMemo(
    () => profile?.role === 'resident' && profile.status === 'approved',
    [profile],
  )

  const getShareUrl = (token: string) =>
    `${window.location.origin}/gate/scan?token=${token}`

  const handleViewQr = async (visit: VisitWithToken) => {
    if (visit.status !== 'active' || !visit.qrToken) {
      toast.error('Esta visita no tiene un QR activo')
      return
    }

    if (expandedVisitId === visit.id) {
      setExpandedVisitId(null)
      return
    }

    if (!qrImagesByVisitId[visit.id]) {
      try {
        const qrDataUrl = await QRCode.toDataURL(
          getShareUrl(visit.qrToken.token),
          {
            width: 320,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
              dark: '#020617',
              light: '#ffffff',
            },
          },
        )

        setQrImagesByVisitId((currentImages) => ({
          ...currentImages,
          [visit.id]: qrDataUrl,
        }))
      } catch (error) {
        console.error('Error generating QR image:', error)
        toast.error('No se pudo generar la imagen QR')
        return
      }
    }

    setExpandedVisitId(visit.id)
  }

  const handleShare = async (visit: VisitWithToken) => {
    if (!visit.qrToken) {
      toast.error('Esta visita no tiene un QR disponible')
      return
    }

    const shareUrl = getShareUrl(visit.qrToken.token)
    const shareText = `Visita para ${visit.visitor_name}: ${shareUrl}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Acceso residencial',
          text: shareText,
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(shareText)
        toast.success('Link copiado para compartir por WhatsApp')
      }
    } catch (error) {
      console.error('Error sharing visit:', error)
      toast.error('No se pudo compartir la visita')
    }
  }

  const handleCancelVisit = async (visit: VisitWithToken) => {
    if (visit.status !== 'active') {
      toast.error('Solo puedes cancelar visitas activas')
      return
    }

    setActionLoadingId(visit.id)

    const { error: visitError } = await supabase
      .from('visits')
      .update({ status: 'cancelled' })
      .eq('id', visit.id)

    if (visitError) {
      console.error('Error cancelling visit:', visitError)
      toast.error(visitError.message)
      setActionLoadingId(null)
      return
    }

    if (visit.qrToken) {
      const { error: tokenError } = await supabase
        .from('qr_tokens')
        .update({ status: 'cancelled' })
        .eq('id', visit.qrToken.id)

      if (tokenError) {
        console.error('Error cancelling QR token:', tokenError)
        toast.error(tokenError.message)
        setActionLoadingId(null)
        return
      }
    }

    toast.success('Visita cancelada correctamente')
    setExpandedVisitId(null)
    setQrImagesByVisitId((currentImages) => {
      const nextImages = { ...currentImages }
      delete nextImages[visit.id]
      return nextImages
    })
    await loadVisits()
    setActionLoadingId(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-28 rounded-full bg-slate-200" />
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="h-6 w-36 rounded-full bg-slate-200" />
            <div className="mt-4 h-4 w-full rounded-full bg-slate-200" />
            <div className="mt-3 h-4 w-3/4 rounded-full bg-slate-200" />
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="h-12 rounded-2xl bg-slate-200" />
              <div className="h-12 rounded-2xl bg-slate-200" />
              <div className="h-12 rounded-2xl bg-slate-200" />
            </div>
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="h-6 w-40 rounded-full bg-slate-200" />
            <div className="mt-4 h-4 w-full rounded-full bg-slate-200" />
            <div className="mt-3 h-4 w-2/3 rounded-full bg-slate-200" />
          </section>
        </div>
      </main>
    )
  }

  if (!canViewVisits) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Mis visitas</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            Acceso no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Tu perfil debe estar aprobado como residente para ver el historial
            de visitas.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 block min-h-12 rounded-2xl bg-slate-950 px-4 py-3 text-center font-semibold text-white active:scale-[0.99]"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <Link
          href="/dashboard"
          className="block text-sm font-semibold text-slate-600"
        >
          ← Volver al dashboard
        </Link>

        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Residente</p>
          <h1 className="mt-1 text-2xl font-bold">Mis visitas</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Revisa tus accesos, comparte el QR o cancela visitas activas.
          </p>
          <Link
            href="/dashboard/visits/new"
            className="mt-5 block min-h-12 rounded-2xl bg-white px-4 py-3 text-center font-semibold text-slate-950 active:scale-[0.99]"
          >
            Nueva visita
          </Link>
        </header>

        {visits.length === 0 ? (
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">
              Aún no tienes visitas
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Crea tu primera visita para generar un código QR de ingreso.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {visits.map((visit) => {
              const expiresAt = new Date(visit.valid_until)
              const expiresDate = new Intl.DateTimeFormat('es-HN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(expiresAt)
              const expiresTime = new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              }).format(expiresAt)
              const isActive = visit.status === 'active'
              const isExpanded = expandedVisitId === visit.id
              const qrDataUrl = qrImagesByVisitId[visit.id]

              return (
                <article
                  key={visit.id}
                  className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">
                        Visitante
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-950">
                        {visit.visitor_name}
                      </h2>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[visit.status]}`}
                    >
                      {statusLabels[visit.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Tipo
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {visitTypeLabels[visit.visit_type]}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Expira
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {expiresDate}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {expiresTime}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleViewQr(visit)}
                      disabled={!isActive || !visit.qrToken}
                      className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50 active:scale-[0.99]"
                    >
                      {isExpanded ? 'Ocultar QR' : 'Ver QR'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare(visit)}
                      disabled={!visit.qrToken}
                      className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-800 disabled:opacity-50 active:scale-[0.99]"
                    >
                      Compartir
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCancelVisit(visit)}
                      disabled={!isActive || actionLoadingId === visit.id}
                      className="min-h-12 w-full rounded-2xl border border-red-200 px-4 py-3 font-semibold text-red-700 disabled:opacity-50 active:scale-[0.99]"
                    >
                      {actionLoadingId === visit.id
                        ? 'Cancelando...'
                        : 'Cancelar visita'}
                    </button>
                  </div>

                  {isExpanded && qrDataUrl && visit.qrToken && (
                    <VisitQrCard
                      qrDataUrl={qrDataUrl}
                      qrScanUrl={getShareUrl(visit.qrToken.token)}
                      visitorName={visit.visitor_name}
                      announcedBy={
                        profile
                          ? `${profile.first_name} ${profile.last_name}`
                          : 'Residente'
                      }
                      accessMode={visit.access_mode}
                      validUntil={visit.valid_until}
                      residentialName={residentialName}
                      houseLabel={houseLabel}
                    />
                  )}
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}
