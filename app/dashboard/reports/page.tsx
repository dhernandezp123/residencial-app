'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MessageSquareWarning, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Role = 'super_admin' | 'admin' | 'resident' | 'guard'
type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'inactive'
type ReportCategory = 'complaint' | 'suggestion' | 'incident'
type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

type CurrentProfile = {
  id: string
  first_name: string
  last_name: string
  role: Role
  status: ProfileStatus
  residential_id: string | null
  house_id: string | null
  is_residential_admin: boolean | null
}

type IncidentReport = {
  id: string
  residential_id: string
  house_id: string | null
  reporter_profile_id: string | null
  guard_profile_id: string | null
  category: ReportCategory
  title: string
  description: string
  is_anonymous: boolean
  status: ReportStatus
  admin_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

type GuardSummary = {
  id: string
  first_name: string
  last_name: string
}

type HouseSummary = {
  id: string
  block: string
  house_number: string
}

type ResidentialSummary = {
  id: string
  name: string
}

type ReporterSummary = {
  id: string
  first_name: string
  last_name: string
}

type EnrichedReport = IncidentReport & {
  house: HouseSummary | null
  residential: ResidentialSummary | null
  reporter: ReporterSummary | null
  guard: GuardSummary | null
}

const categoryLabels: Record<ReportCategory, string> = {
  complaint: 'Queja',
  suggestion: 'Sugerencia',
  incident: 'Incidente',
}

const statusLabels: Record<ReportStatus, string> = {
  open: 'Abierto',
  reviewing: 'En revisión',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
}

const statusClasses: Record<ReportStatus, string> = {
  open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  reviewing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  dismissed: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

const initialForm = {
  category: 'complaint' as ReportCategory,
  guard_profile_id: '',
  title: '',
  description: '',
  is_anonymous: true,
}

export default function ReportsPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [reports, setReports] = useState<EnrichedReport[]>([])
  const [guards, setGuards] = useState<GuardSummary[]>([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  const isAdminView =
    profile?.role === 'admin' ||
    profile?.role === 'super_admin' ||
    Boolean(profile?.is_residential_admin)
  const isResidentView =
    profile?.role === 'resident' && !profile.is_residential_admin

  const loadData = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      toast.error('Inicia sesión para continuar')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,role,status,residential_id,house_id,is_residential_admin')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError || !profileData) {
      console.error('Error loading profile:', profileError)
      toast.error('No se pudo cargar tu perfil')
      setLoading(false)
      return
    }

    const currentProfile = profileData as CurrentProfile
    setProfile(currentProfile)

    if (currentProfile.status !== 'approved') {
      setLoading(false)
      return
    }

    if (currentProfile.role === 'resident' && currentProfile.residential_id) {
      const { data: guardData, error: guardError } = await supabase
        .from('profiles')
        .select('id,first_name,last_name')
        .eq('role', 'guard')
        .eq('status', 'approved')
        .eq('residential_id', currentProfile.residential_id)
        .order('first_name', { ascending: true })

      if (guardError) {
        console.error('Error loading guards:', guardError)
        toast.error('No se pudieron cargar los guardias')
      } else {
        setGuards((guardData || []) as GuardSummary[])
      }
    }

    if (
      currentProfile.role === 'admin' ||
      currentProfile.role === 'super_admin' ||
      currentProfile.is_residential_admin
    ) {
      await loadReports(currentProfile)
    } else if (currentProfile.role === 'resident') {
      await loadReports(currentProfile, currentProfile.id)
    }

    setLoading(false)
  }

  const loadReports = async (currentProfile: CurrentProfile, reporterId?: string) => {
    let query = supabase
      .from('incident_reports')
      .select(
        'id,residential_id,house_id,reporter_profile_id,guard_profile_id,category,title,description,is_anonymous,status,admin_notes,resolved_at,created_at,updated_at',
      )
      .order('created_at', { ascending: false })

    if (reporterId) {
      query = query.eq('reporter_profile_id', reporterId)
    }

    if (
      (currentProfile.role === 'admin' ||
        currentProfile.is_residential_admin) &&
      currentProfile.residential_id
    ) {
      query = query.eq('residential_id', currentProfile.residential_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading reports:', error)
      toast.error('No se pudieron cargar los reportes')
      setReports([])
      return
    }

    const rows = (data || []) as IncidentReport[]
    const enrichedReports = await enrichReports(rows)
    setReports(enrichedReports)
    setNotesDraft(
      Object.fromEntries(enrichedReports.map((report) => [report.id, report.admin_notes || ''])),
    )
  }

  const enrichReports = async (rows: IncidentReport[]) => {
    const houseIds = uniqueIds(rows.map((report) => report.house_id))
    const residentialIds = uniqueIds(rows.map((report) => report.residential_id))
    const reporterIds = uniqueIds(rows.map((report) => report.reporter_profile_id))
    const guardIds = uniqueIds(rows.map((report) => report.guard_profile_id))

    const { data: housesData, error: housesError } =
      houseIds.length > 0
        ? await supabase
            .from('houses')
            .select('id,block,house_number')
            .in('id', houseIds)
        : { data: [], error: null }

    if (housesError) {
      console.error('Error loading report houses:', housesError)
    }

    const { data: residentialsData, error: residentialsError } =
      residentialIds.length > 0
        ? await supabase
            .from('residentials')
            .select('id,name')
            .in('id', residentialIds)
        : { data: [], error: null }

    if (residentialsError) {
      console.error('Error loading report residentials:', residentialsError)
    }

    const { data: reportersData, error: reportersError } =
      reporterIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id,first_name,last_name')
            .in('id', reporterIds)
        : { data: [], error: null }

    if (reportersError) {
      console.error('Error loading report reporters:', reportersError)
    }

    const { data: guardsData, error: guardsError } =
      guardIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id,first_name,last_name')
            .in('id', guardIds)
        : { data: [], error: null }

    if (guardsError) {
      console.error('Error loading report guards:', guardsError)
    }

    const housesById = new Map(((housesData || []) as HouseSummary[]).map((house) => [house.id, house]))
    const residentialsById = new Map(
      ((residentialsData || []) as ResidentialSummary[]).map((residential) => [
        residential.id,
        residential,
      ]),
    )
    const reportersById = new Map(
      ((reportersData || []) as ReporterSummary[]).map((reporter) => [reporter.id, reporter]),
    )
    const guardsById = new Map(((guardsData || []) as GuardSummary[]).map((guard) => [guard.id, guard]))

    return rows.map((report) => ({
      ...report,
      house: report.house_id ? housesById.get(report.house_id) || null : null,
      residential: residentialsById.get(report.residential_id) || null,
      reporter: report.reporter_profile_id
        ? reportersById.get(report.reporter_profile_id) || null
        : null,
      guard: report.guard_profile_id ? guardsById.get(report.guard_profile_id) || null : null,
    }))
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!profile || profile.role !== 'resident') return
    if (!profile.residential_id || !profile.house_id) {
      toast.error('Tu perfil debe tener residencial y casa asignados')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('incident_reports').insert({
      residential_id: profile.residential_id,
      house_id: form.is_anonymous ? null : profile.house_id,
      reporter_profile_id: form.is_anonymous ? null : profile.id,
      guard_profile_id: form.guard_profile_id || null,
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim(),
      is_anonymous: form.is_anonymous,
    })

    setSaving(false)

    if (error) {
      console.error('Error creating report:', error)
      toast.error('No se pudo enviar el reporte')
      return
    }

    toast.success('Reporte enviado correctamente')
    setForm(initialForm)
    await loadReports(profile, profile.id)
  }

  const handleUpdateReport = async (report: EnrichedReport, status: ReportStatus) => {
    const adminNotes = notesDraft[report.id] || ''
    setUpdatingId(report.id)

    const { error } = await supabase
      .from('incident_reports')
      .update({
        status,
        admin_notes: adminNotes.trim() || null,
        resolved_at:
          status === 'resolved' || status === 'dismissed'
            ? new Date().toISOString()
            : null,
      })
      .eq('id', report.id)

    setUpdatingId(null)

    if (error) {
      console.error('Error updating report:', error)
      toast.error('No se pudo actualizar el reporte')
      return
    }

    toast.success('Reporte actualizado')
    if (profile) await loadReports(profile, profile.role === 'resident' ? profile.id : undefined)
  }

  const openCount = useMemo(
    () => reports.filter((report) => report.status === 'open' || report.status === 'reviewing').length,
    [reports],
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-5 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-300 dark:bg-slate-700" />
          <div className="h-56 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
        </div>
      </main>
    )
  }

  if (!profile || profile.status !== 'approved' || (!isResidentView && !isAdminView)) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Acceso no disponible</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Esta sección está disponible para residentes, administradores y super administradores aprobados.
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
        <Link
          href="/dashboard"
          className="block text-sm font-semibold text-slate-600 dark:text-slate-300"
        >
          ← Volver al dashboard
        </Link>

        <header className="rounded-2xl bg-slate-950 dark:bg-slate-800 p-6 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-white/10 p-2">
              {isAdminView ? (
                <ShieldAlert className="h-6 w-6" />
              ) : (
                <MessageSquareWarning className="h-6 w-6" />
              )}
            </span>
            <div>
              <p className="text-sm text-slate-300">
                {isAdminView ? 'Administración' : 'Mi residencial'}
              </p>
              <h1 className="mt-1 text-2xl font-bold">Quejas y sugerencias</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {isAdminView
                  ? `${openCount} reporte${openCount !== 1 ? 's' : ''} pendiente${openCount !== 1 ? 's' : ''} de seguimiento.`
                  : 'Envía reportes de forma anónima o con tus datos visibles para administración.'}
              </p>
            </div>
          </div>
        </header>

        {isResidentView && (
          <ResidentReportForm
            form={form}
            guards={guards}
            saving={saving}
            onChange={setForm}
            onSubmit={handleSubmit}
          />
        )}

        {reports.length === 0 ? (
          <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 text-sm leading-6 text-slate-500 dark:text-slate-400 shadow-sm">
            No hay reportes registrados.
          </section>
        ) : (
          <section className="space-y-3">
            {reports.map((report) =>
              isAdminView ? (
                <AdminReportCard
                  key={report.id}
                  report={report}
                  saving={updatingId === report.id}
                  notes={notesDraft[report.id] || ''}
                  onNotesChange={(value) =>
                    setNotesDraft((current) => ({ ...current, [report.id]: value }))
                  }
                  onUpdate={(status) => handleUpdateReport(report, status)}
                />
              ) : (
                <ResidentReportCard key={report.id} report={report} />
              ),
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function ResidentReportForm({
  form,
  guards,
  saving,
  onChange,
  onSubmit,
}: {
  form: typeof initialForm
  guards: GuardSummary[]
  saving: boolean
  onChange: (form: typeof initialForm) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tipo</span>
        <select
          value={form.category}
          onChange={(event) => onChange({ ...form, category: event.target.value as ReportCategory })}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
          <option value="complaint">Queja</option>
          <option value="suggestion">Sugerencia</option>
          <option value="incident">Incidente con guardia</option>
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Guardia relacionado</span>
        <select
          value={form.guard_profile_id}
          onChange={(event) => onChange({ ...form, guard_profile_id: event.target.value })}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
          <option value="">No aplica / no sé quién fue</option>
          {guards.map((guard) => (
            <option key={guard.id} value={guard.id}>
              {guard.first_name} {guard.last_name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Título</span>
        <input
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          maxLength={120}
          required
          placeholder="Ej: Trato inadecuado en garita"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Detalle</span>
        <textarea
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          rows={5}
          required
          placeholder="Describe qué ocurrió, fecha aproximada y cualquier detalle útil."
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
      </label>

      <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-700/60">
        <input
          type="checkbox"
          checked={form.is_anonymous}
          onChange={(event) => onChange({ ...form, is_anonymous: event.target.checked })}
          className="mt-1 h-5 w-5 rounded border-slate-300"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
            Enviar como anónimo
          </span>
          <span className="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">
            Administración verá el reporte, pero no se guardará tu nombre ni tu casa.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99] dark:bg-slate-700"
      >
        {saving ? 'Enviando...' : 'Enviar reporte'}
      </button>
    </form>
  )
}

function ResidentReportCard({ report }: { report: EnrichedReport }) {
  return (
    <article className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
      <ReportCardHeader report={report} />
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{report.description}</p>
      <div className="mt-4 space-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <p>{report.is_anonymous ? 'Enviado como anónimo' : 'Enviado con tus datos visibles'}</p>
        {report.admin_notes && <p>Nota de administración: {report.admin_notes}</p>}
      </div>
    </article>
  )
}

function AdminReportCard({
  report,
  saving,
  notes,
  onNotesChange,
  onUpdate,
}: {
  report: EnrichedReport
  saving: boolean
  notes: string
  onNotesChange: (value: string) => void
  onUpdate: (status: ReportStatus) => void
}) {
  const reporterName = report.is_anonymous
    ? 'Anónimo'
    : report.reporter
      ? `${report.reporter.first_name} ${report.reporter.last_name}`.trim()
      : 'Residente'
  const houseLabel = report.is_anonymous
    ? 'Oculta por anonimato'
    : report.house
      ? `${report.house.block}-${report.house.house_number}`
      : 'Sin casa'
  const guardName = report.guard
    ? `${report.guard.first_name} ${report.guard.last_name}`.trim()
    : 'No especificado'

  return (
    <article className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
      <ReportCardHeader report={report} />
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{report.description}</p>

      <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
        <p><span className="font-semibold text-slate-800 dark:text-slate-100">Residente:</span> {reporterName}</p>
        <p><span className="font-semibold text-slate-800 dark:text-slate-100">Casa:</span> {houseLabel}</p>
        <p><span className="font-semibold text-slate-800 dark:text-slate-100">Guardia:</span> {guardName}</p>
        <p><span className="font-semibold text-slate-800 dark:text-slate-100">Residencial:</span> {report.residential?.name || 'Sin residencial'}</p>
      </div>

      <label className="mt-4 block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notas internas</span>
        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={3}
          placeholder="Seguimiento, llamadas, resolución o acciones tomadas."
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(['reviewing', 'resolved', 'dismissed', 'open'] as ReportStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onUpdate(status)}
            disabled={saving}
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 active:scale-[0.99] dark:border-slate-600 dark:text-slate-200"
          >
            {saving ? 'Guardando...' : statusLabels[status]}
          </button>
        ))}
      </div>
    </article>
  )
}

function ReportCardHeader({ report }: { report: EnrichedReport }) {
  const formattedDate = new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(report.created_at))

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {categoryLabels[report.category]} · {formattedDate}
          </p>
          <h2 className="mt-1 text-lg font-bold leading-tight text-slate-900 dark:text-white">
            {report.title}
          </h2>
        </div>
        <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[report.status]}`}>
          {statusLabels[report.status]}
        </span>
      </div>
    </div>
  )
}

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
}
