'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { VisitQrCard } from './VisitQrCard'
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

const PAGE_SIZE = 10

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
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  used: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  expired: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

export default function VisitsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [visits, setVisits] = useState<VisitWithToken[]>([])
  const [residentialName, setResidentialName] = useState('Residencial')
  const [houseLabel, setHouseLabel] = useState('Casa')
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [visitsOffset, setVisitsOffset] = useState(0)
  const [qrImagesByVisitId, setQrImagesByVisitId] = useState<
    Record<string, string>
  >({})
  const [openEntriesByVisitId, setOpenEntriesByVisitId] = useState<
    Record<string, boolean>
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
      .range(0, PAGE_SIZE)

    if (visitsError) {
      console.error('Error loading visits:', visitsError)
      toast.error('No se pudieron cargar tus visitas')
      setLoading(false)
      return
    }

    const allFetched = (visitsData || []) as Visit[]
    const loadedVisits = allFetched.slice(0, PAGE_SIZE)
    setHasMore(allFetched.length > PAGE_SIZE)
    setVisitsOffset(PAGE_SIZE)
    const visitIds = loadedVisits.map((visit) => visit.id)
    let tokensByVisitId: Record<string, QrToken> = {}

    if (visitIds.length > 0) {
      const [
        { data: tokensData, error: tokensError },
        { data: entriesData },
      ] = await Promise.all([
        supabase
          .from('qr_tokens')
          .select('id,visit_id,token,status,expires_at,created_at')
          .in('visit_id', visitIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('visitor_entries')
          .select('visit_id')
          .in('visit_id', visitIds)
          .is('exit_time', null)
          .eq('entry_status', 'allowed'),
      ])

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

      const openMap: Record<string, boolean> = {}
      ;(entriesData || []).forEach((e: { visit_id: string }) => {
        openMap[e.visit_id] = true
      })
      setOpenEntriesByVisitId(openMap)
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

  const handleLoadMore = async () => {
    if (!profile || loadingMore) return
    setLoadingMore(true)

    const { data, error } = await supabase
      .from('visits')
      .select('id,visitor_name,visit_type,access_mode,valid_until,status,created_at')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false })
      .range(visitsOffset, visitsOffset + PAGE_SIZE)

    if (error) {
      toast.error('No se pudieron cargar más visitas')
      setLoadingMore(false)
      return
    }

    const newVisits = (data || []) as Visit[]
    const page = newVisits.slice(0, PAGE_SIZE)

    const newVisitIds = page.map((v) => v.id)
    let newTokensByVisitId: Record<string, QrToken> = {}

    if (newVisitIds.length > 0) {
      const [{ data: tokensData }, { data: newEntriesData }] =
        await Promise.all([
          supabase
            .from('qr_tokens')
            .select('id,visit_id,token,status,expires_at,created_at')
            .in('visit_id', newVisitIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('visitor_entries')
            .select('visit_id')
            .in('visit_id', newVisitIds)
            .is('exit_time', null)
            .eq('entry_status', 'allowed'),
        ])

      newTokensByVisitId = ((tokensData || []) as QrToken[]).reduce<
        Record<string, QrToken>
      >((acc, token) => {
        if (!acc[token.visit_id]) acc[token.visit_id] = token
        return acc
      }, {})

      const moreOpenMap: Record<string, boolean> = {}
      ;(newEntriesData || []).forEach((e: { visit_id: string }) => {
        moreOpenMap[e.visit_id] = true
      })
      setOpenEntriesByVisitId((prev) => ({ ...prev, ...moreOpenMap }))
    }

    setVisits((prev) => [
      ...prev,
      ...page.map((v) => ({ ...v, qrToken: newTokensByVisitId[v.id] || null })),
    ])
    setHasMore(newVisits.length > PAGE_SIZE)
    setVisitsOffset((prev) => prev + PAGE_SIZE)
    setLoadingMore(false)
  }

  const canViewVisits = useMemo(
    () => profile?.role === 'resident' && profile.status === 'approved',
    [profile],
  )

  const getShareUrl = (token: string) =>
    `${window.location.origin}/gate/scan?token=${token}`

  const handleViewQr = async (visit: VisitWithToken) => {
    const isExpiredNow =
      visit.status === 'expired' ||
      visit.qrToken?.status === 'expired' ||
      new Date(visit.valid_until).getTime() <= new Date().getTime() ||
      (visit.qrToken
        ? new Date(visit.qrToken.expires_at).getTime() <= new Date().getTime()
        : false)

    if (
      isExpiredNow ||
      visit.status !== 'active' ||
      visit.qrToken?.status !== 'active'
    ) {
      toast.error('Este QR ya no está activo')
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

  const handleCancelVisit = async (visit: VisitWithToken) => {
    const isExpiredNow =
      visit.status === 'expired' ||
      new Date(visit.valid_until).getTime() <= new Date().getTime()

    if (isExpiredNow || visit.status !== 'active') {
      toast.error('Solo puedes cancelar visitas activas')
      return
    }

    if (cancelConfirmId !== visit.id) {
      setCancelConfirmId(visit.id)
      toast.warning('Toca nuevamente para confirmar la cancelación')
      return
    }

    setCancelConfirmId(null)
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
    setCancelConfirmId(null)
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
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
            <div className="h-6 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="h-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
              <div className="h-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
              <div className="h-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            </div>
          </section>
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
            <div className="h-6 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          </section>
        </div>
      </main>
    )
  }

  if (!canViewVisits) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Mis visitas</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            Acceso no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Tu perfil debe estar aprobado como residente para ver el historial
            de visitas.
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

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <PageHeader title="Mis visitas" subtitle="Visitas activas e historial" />

        <Link
          href="/dashboard/visits/new"
          className="block min-h-14 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-4 text-center text-lg font-bold text-white shadow-sm active:scale-[0.99]"
        >
          + Nueva visita
        </Link>

        {visits.length === 0 ? (
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Aún no tienes visitas
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Crea tu primera visita para generar un código QR de ingreso.
            </p>
          </section>
        ) : (
          <section className="space-y-4" aria-label="Lista de visitas">
            {visits.map((visit) => {
              const expiresAt = new Date(visit.valid_until)
              const tokenExpiresAt = visit.qrToken
                ? new Date(visit.qrToken.expires_at)
                : expiresAt
              const expiresLabel = new Intl.DateTimeFormat('es-HN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(expiresAt)
              const isExpanded = expandedVisitId === visit.id
              const qrDataUrl = qrImagesByVisitId[visit.id]
              const isExpiredNow =
                visit.status === 'expired' ||
                visit.qrToken?.status === 'expired' ||
                (visit.status === 'active' &&
                  expiresAt.getTime() <= new Date().getTime()) ||
                (visit.qrToken?.status === 'active' &&
                  tokenExpiresAt.getTime() <= new Date().getTime())
              const effectiveStatus: VisitStatus = isExpiredNow
                ? 'expired'
                : visit.status
              const canUseQr =
                effectiveStatus === 'active' && visit.qrToken?.status === 'active'
              const isVisitorInside = openEntriesByVisitId[visit.id] === true

              return (
                <article
                  key={visit.id}
                  className="space-y-4 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                        Visitante
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                        {visit.visitor_name}
                      </h2>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[effectiveStatus]}`}
                    >
                      {statusLabels[effectiveStatus]}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                        Tipo
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {visitTypeLabels[visit.visit_type]}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                        Acceso
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {visit.access_mode === 'single_use' ? 'Uso único' : 'Múltiple'}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Expira
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {expiresLabel}
                    </p>
                  </div>

                  {isVisitorInside && (
                    <div className="rounded-2xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                        Visitante dentro
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-blue-600 dark:text-blue-400">
                        {visit.visitor_name} está dentro del residencial y aún no ha registrado salida.
                      </p>
                    </div>
                  )}

                  {isExpiredNow && (
                    <div className="rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        QR vencido
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-amber-600 dark:text-amber-400">
                        Este código ya no puede ser utilizado para ingresos.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleViewQr(visit)}
                      disabled={!canUseQr}
                      className="min-h-12 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 font-semibold text-white disabled:opacity-50 active:scale-[0.99]"
                    >
                      {isExpanded ? 'Ocultar QR' : 'Ver QR'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCancelVisit(visit)}
                      disabled={effectiveStatus !== 'active' || actionLoadingId === visit.id}
                      className={`min-h-12 w-full rounded-2xl px-4 py-3 font-semibold disabled:opacity-50 active:scale-[0.99] ${
                        cancelConfirmId === visit.id
                          ? 'bg-red-600 text-white'
                          : 'border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {actionLoadingId === visit.id
                        ? 'Cancelando...'
                        : cancelConfirmId === visit.id
                          ? 'Confirmar cancelación'
                          : 'Cancelar visita'}
                    </button>
                  </div>

                  {isExpanded && qrDataUrl && visit.qrToken && (
                    <VisitQrCard
                      qrDataUrl={qrDataUrl}
                      visitorName={visit.visitor_name}
                      announcedBy={
                        profile
                          ? `${profile.first_name} ${profile.last_name}`
                          : 'Residente'
                      }
                      accessMode={visit.access_mode}
                      createdAt={visit.created_at}
                      validUntil={visit.valid_until}
                      residentialName={residentialName}
                      houseLabel={houseLabel}
                    />
                  )}
                </article>
              )
            })}

            {hasMore && (
              <button
                type="button"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
                className="min-h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-60 active:scale-[0.99]"
              >
                {loadingMore ? 'Cargando...' : 'Cargar más visitas'}
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
