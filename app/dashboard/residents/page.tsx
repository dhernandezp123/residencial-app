'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { DashboardHeader, EmptyState, StatusBadge } from '@/components/ui'

type ResidentStatus = 'pending' | 'approved' | 'rejected' | 'inactive'
type ProfileRole = 'super_admin' | 'admin' | 'resident' | 'guard'

type CurrentProfile = {
  id: string
  role: ProfileRole
  status: ResidentStatus
  is_residential_admin: boolean | null
}

type ResidentProfile = {
  id: string
  user_id: string
  residential_id: string | null
  house_id: string | null
  first_name: string
  last_name: string
  phone: string | null
  status: ResidentStatus
  role: 'resident'
  residential: ResidentialSummary | null
  house: HouseSummary | null
}

type ResidentProfileRow = Omit<ResidentProfile, 'residential' | 'house'>

type ResidentialSummary = {
  id: string
  name: string
}

type HouseSummary = {
  id: string
  block: string
  house_number: string
  pays_security: boolean
  resident_limit: number | null
}

type ResidentAction = 'approve' | 'reject' | 'deactivate' | 'editName'

type NameEditForm = {
  first_name: string
  last_name: string
}

const filters: { label: string; value: ResidentStatus }[] = [
  { label: 'Pendientes', value: 'pending' },
  { label: 'Aprobados', value: 'approved' },
  { label: 'Rechazados', value: 'rejected' },
  { label: 'Inactivos', value: 'inactive' },
]

export default function ResidentsPage() {
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(
    null,
  )
  const [residents, setResidents] = useState<ResidentProfile[]>([])
  const [selectedStatus, setSelectedStatus] = useState<ResidentStatus>('pending')
  const [loading, setLoading] = useState(true)
  const [savingResidentId, setSavingResidentId] = useState<string | null>(null)
  const [editingNameResidentId, setEditingNameResidentId] = useState<
    string | null
  >(null)
  const [nameEditForm, setNameEditForm] = useState<NameEditForm>({
    first_name: '',
    last_name: '',
  })
  const [confirmingResidentAction, setConfirmingResidentAction] = useState<{
    residentId: string
    action: ResidentAction
  } | null>(null)

  const loadResidents = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesiÃ³n para continuar')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,role,status,is_residential_admin')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError || !profileData) {
      console.error('Error loading current profile:', profileError)
      toast.error('No se pudo cargar tu perfil')
      setLoading(false)
      return
    }

    setCurrentProfile(profileData as CurrentProfile)

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id,user_id,first_name,last_name,phone,status,role,residential_id,house_id'
      )
      .eq('role', 'resident')
      .in('status', ['pending', 'approved', 'rejected', 'inactive'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading residents:', error)
      toast.error('No se pudieron cargar los residentes')
      setResidents([])
      setLoading(false)
      return
    }

    const rows = (data || []) as ResidentProfileRow[]
    const residentialIds = Array.from(
      new Set(
        rows
          .map((resident) => resident.residential_id)
          .filter((residentialId): residentialId is string =>
            Boolean(residentialId)
          )
      )
    )
    const houseIds = Array.from(
      new Set(
        rows
          .map((resident) => resident.house_id)
          .filter((houseId): houseId is string => Boolean(houseId))
      )
    )

    const { data: residentialsData, error: residentialsError } =
      residentialIds.length > 0
        ? await supabase
            .from('residentials')
            .select('id,name')
            .in('id', residentialIds)
        : { data: [], error: null }

    if (residentialsError) {
      console.error('Error loading resident residentials:', residentialsError)
      toast.error('No se pudieron cargar los residenciales')
      setResidents([])
      setLoading(false)
      return
    }

    const { data: housesData, error: housesError } =
      houseIds.length > 0
        ? await supabase
            .from('houses')
            .select('id,block,house_number,pays_security,resident_limit')
            .in('id', houseIds)
        : { data: [], error: null }

    if (housesError) {
      console.error('Error loading resident houses:', housesError)
      toast.error('No se pudieron cargar las casas')
      setResidents([])
      setLoading(false)
      return
    }

    const residentialById = new Map(
      ((residentialsData || []) as ResidentialSummary[]).map((residential) => [
        residential.id,
        residential,
      ])
    )
    const houseById = new Map(
      ((housesData || []) as HouseSummary[]).map((house) => [house.id, house])
    )

    const enrichedResidents: ResidentProfile[] = rows.map((resident) => ({
      ...resident,
      residential: resident.residential_id
        ? residentialById.get(resident.residential_id) || null
        : null,
      house: resident.house_id ? houseById.get(resident.house_id) || null : null,
    }))

    setResidents(enrichedResidents)
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadResidents)
  }, [])

  useEffect(() => {
    if (!confirmingResidentAction) return

    const timer = window.setTimeout(() => {
      setConfirmingResidentAction(null)
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [confirmingResidentAction])

  const requestResidentConfirmation = (
    residentId: string,
    action: ResidentAction,
    message: string,
  ): boolean => {
    if (
      confirmingResidentAction?.residentId === residentId &&
      confirmingResidentAction.action === action
    ) {
      setConfirmingResidentAction(null)
      return true
    }

    setConfirmingResidentAction({ residentId, action })
    toast.warning(message)
    return false
  }

  const startEditingResidentName = (resident: ResidentProfile) => {
    setEditingNameResidentId(resident.id)
    setNameEditForm({
      first_name: resident.first_name,
      last_name: resident.last_name,
    })
    setConfirmingResidentAction(null)
  }

  const updateNameEditForm = (nextForm: NameEditForm) => {
    setNameEditForm(nextForm)

    if (confirmingResidentAction?.action === 'editName') {
      setConfirmingResidentAction(null)
    }
  }

  const cancelEditingResidentName = () => {
    setEditingNameResidentId(null)
    setNameEditForm({ first_name: '', last_name: '' })
    setConfirmingResidentAction(null)
  }

  const handleUpdateResidentName = async (resident: ResidentProfile) => {
    if (currentProfile?.role !== 'super_admin') {
      toast.error('Solo superadmin puede editar nombres de residentes')
      return
    }

    const firstName = nameEditForm.first_name.trim()
    const lastName = nameEditForm.last_name.trim()

    if (!firstName || !lastName) {
      toast.error('Nombre y apellido son obligatorios')
      return
    }

    if (
      firstName === resident.first_name.trim() &&
      lastName === resident.last_name.trim()
    ) {
      toast.info('No hay cambios para guardar')
      return
    }

    if (
      !requestResidentConfirmation(
        resident.id,
        'editName',
        'Toca de nuevo para confirmar el cambio de nombre',
      )
    ) {
      return
    }

    setSavingResidentId(resident.id)

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
      })
      .eq('id', resident.id)
      .eq('role', 'resident')

    setSavingResidentId(null)

    if (error) {
      console.error('Error updating resident name:', error)
      toast.error('No se pudo actualizar el nombre')
      return
    }

    toast.success('Nombre actualizado')
    cancelEditingResidentName()
    loadResidents()
  }

  const handleUpdateStatus = async (
    resident: ResidentProfile,
    status: ResidentStatus
  ) => {
    const action: ResidentAction = status === 'approved' ? 'approve' : 'reject'

    if (
      !requestResidentConfirmation(
        resident.id,
        action,
        status === 'approved'
          ? 'Toca de nuevo para aprobar este residente'
          : 'Toca de nuevo para rechazar este residente',
      )
    ) {
      return
    }

    setSavingResidentId(resident.id)

    if (status === 'approved') {
      if (!resident.house_id) {
        toast.error('Este residente no tiene una casa asignada')
        setSavingResidentId(null)
        return
      }

      if (!resident.house) {
        toast.error('No se pudo validar la casa del residente')
        setSavingResidentId(null)
        return
      }

      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('house_id', resident.house_id)
        .eq('role', 'resident')
        .eq('status', 'approved')

      if (countError) {
        console.error('Error counting approved residents:', countError)
        toast.error('No se pudo validar el cupo de la casa')
        setSavingResidentId(null)
        return
      }

      const residentLimit = resident.house.resident_limit || 3

      if ((count || 0) >= residentLimit) {
        toast.error('Esta casa ya alcanzó el máximo de usuarios app permitidos')
        setSavingResidentId(null)
        return
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', resident.id)
      .eq('role', 'resident')

    setSavingResidentId(null)

    if (error) {
      console.error('Error updating resident status:', error)
      toast.error('No se pudo actualizar el residente')
      return
    }

    toast.success(
      status === 'approved' ? 'Residente aprobado' : 'Residente rechazado'
    )

    loadResidents()
  }

  const handleDeactivateResident = async (resident: ResidentProfile) => {
    if (
      !requestResidentConfirmation(
        resident.id,
        'deactivate',
        'Toca de nuevo para inactivar y quitar de casa',
      )
    ) {
      return
    }

    setSavingResidentId(resident.id)

    const { error } = await supabase
      .from('profiles')
      .update({
        status: 'inactive',
        house_id: null,
      })
      .eq('id', resident.id)
      .eq('role', 'resident')

    setSavingResidentId(null)

    if (error) {
      console.error('Error deactivating resident:', error)
      toast.error('No se pudo inactivar el residente')
      return
    }

    toast.success('Residente inactivado')
    loadResidents()
  }

  const handleSendPasswordReset = async (resident: ResidentProfile) => {
    setSavingResidentId(resident.id)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      toast.error('Inicia sesión nuevamente')
      setSavingResidentId(null)
      return
    }

    const response = await fetch('/api/admin/send-password-reset', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ profileId: resident.id }),
    })

    setSavingResidentId(null)

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      toast.error(payload.error || 'No se pudo enviar el reset')
      return
    }

    toast.success('Correo de recuperación enviado')
  }

  const filteredResidents = residents.filter(
    (resident) => resident.status === selectedStatus
  )
  const canEditResidentNames = currentProfile?.role === 'super_admin'

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <Link
          href="/dashboard"
          className="block text-sm font-semibold text-slate-600 dark:text-slate-300"
        >
          ← Volver al dashboard
        </Link>

        <DashboardHeader
          eyebrow="Administracion"
          title="Residentes"
          subtitle="Revisa solicitudes y controla quien puede anunciar visitas desde la app."
        />

        <section className="grid grid-cols-2 gap-2 rounded-2xl bg-white dark:bg-slate-800 p-2 shadow-sm">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setSelectedStatus(filter.value)}
              className={`min-h-12 rounded-xl px-3 text-sm font-semibold active:scale-[0.99] ${
                selectedStatus === filter.value
                  ? 'bg-slate-950 dark:bg-slate-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </section>

        {loading ? (
          <ResidentsSkeleton />
        ) : filteredResidents.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="h-6 w-6" />}
            title="No hay residentes en este estado"
            description="Cuando existan solicitudes o residentes con este estado, apareceran aqui."
          />
        ) : (
          <section className="space-y-3">
            {filteredResidents.map((resident) => {
              const confirmingAction =
                confirmingResidentAction?.residentId === resident.id
                  ? confirmingResidentAction.action
                  : null

              return (
                <ResidentCard
                  key={resident.id}
                  resident={resident}
                  saving={savingResidentId === resident.id}
                  confirmingAction={confirmingAction}
                  onApprove={() => handleUpdateStatus(resident, 'approved')}
                  onReject={() => handleUpdateStatus(resident, 'rejected')}
                  onDeactivate={() => handleDeactivateResident(resident)}
                  onSendPasswordReset={() => handleSendPasswordReset(resident)}
                  canEditName={canEditResidentNames}
                  isEditingName={editingNameResidentId === resident.id}
                  nameEditForm={nameEditForm}
                  onStartEditName={() => startEditingResidentName(resident)}
                  onCancelEditName={cancelEditingResidentName}
                  onNameEditFormChange={updateNameEditForm}
                  onSaveName={() => handleUpdateResidentName(resident)}
                />
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

function ResidentCard({
  resident,
  saving,
  confirmingAction,
  onApprove,
  onReject,
  onDeactivate,
  onSendPasswordReset,
  canEditName,
  isEditingName,
  nameEditForm,
  onStartEditName,
  onCancelEditName,
  onNameEditFormChange,
  onSaveName,
}: {
  resident: ResidentProfile
  saving: boolean
  confirmingAction: ResidentAction | null
  onApprove: () => void
  onReject: () => void
  onDeactivate: () => void
  onSendPasswordReset: () => void
  canEditName: boolean
  isEditingName: boolean
  nameEditForm: NameEditForm
  onStartEditName: () => void
  onCancelEditName: () => void
  onNameEditFormChange: (nextForm: NameEditForm) => void
  onSaveName: () => void
}) {
  const fullName = `${resident.first_name} ${resident.last_name}`.trim()
  const houseLabel = resident.house
    ? `${resident.house.block}-${resident.house.house_number}`
    : 'Sin casa'

  return (
    <article className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {fullName || 'Sin nombre'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {resident.phone || 'Sin teléfono'}
          </p>
        </div>

        <StatusBadge tone={getResidentStatusTone(resident.status)}>
          {getStatusLabel(resident.status)}
        </StatusBadge>
      </div>

      {canEditName && (
        <div className="mt-4">
          {isEditingName ? (
            <div className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-700/60">
              <div className="grid gap-3">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Nombre
                  </span>
                  <input
                    value={nameEditForm.first_name}
                    onChange={(event) =>
                      onNameEditFormChange({
                        ...nameEditForm,
                        first_name: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Apellido
                  </span>
                  <input
                    value={nameEditForm.last_name}
                    onChange={(event) =>
                      onNameEditFormChange({
                        ...nameEditForm,
                        last_name: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onCancelEditName}
                  disabled={saving}
                  className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 active:scale-[0.99] dark:border-slate-600 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onSaveName}
                  disabled={saving}
                  className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 active:scale-[0.99] ${
                    confirmingAction === 'editName'
                      ? 'bg-amber-500'
                      : 'bg-slate-950 dark:bg-slate-600'
                  }`}
                >
                  {saving
                    ? 'Guardando...'
                    : confirmingAction === 'editName'
                      ? 'Confirmar cambio'
                      : 'Guardar nombre'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartEditName}
              disabled={saving}
              className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 active:scale-[0.99] dark:border-slate-700 dark:text-slate-200"
            >
              Editar nombre
            </button>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          <span className="font-semibold text-slate-800 dark:text-slate-200">Residencial:</span>{' '}
          {resident.residential?.name || 'Sin residencial'}
        </p>
        <p>
          <span className="font-semibold text-slate-800 dark:text-slate-200">Casa:</span>{' '}
          {houseLabel}
        </p>
        <p>
          <span className="font-semibold text-slate-800 dark:text-slate-200">Paga seguridad:</span>{' '}
          {resident.house?.pays_security ? 'Sí' : 'No'}
        </p>
        <p>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Usuarios app permitidos:
          </span>{' '}
          {resident.house?.resident_limit || 3}
        </p>
      </div>

      {resident.status === 'pending' && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onReject}
            disabled={saving}
            className={`min-h-12 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60 active:scale-[0.99] ${
              confirmingAction === 'reject'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300'
            }`}
          >
            {confirmingAction === 'reject' ? 'Confirmar rechazo' : 'Rechazar'}
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={saving}
            className={`min-h-12 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 active:scale-[0.99] ${
              confirmingAction === 'approve' ? 'bg-amber-500' : 'bg-green-600'
            }`}
          >
            {saving
              ? 'Guardando...'
              : confirmingAction === 'approve'
                ? 'Confirmar aprobacion'
                : 'Aprobar'}
          </button>
        </div>
      )}

      {resident.status !== 'inactive' && (
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={onSendPasswordReset}
            disabled={saving}
            className="min-h-12 w-full rounded-xl border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm font-semibold text-blue-700 dark:text-blue-300 disabled:opacity-60 active:scale-[0.99]"
          >
            {saving ? 'Enviando...' : 'Enviar reset de contraseña'}
          </button>
          <button
            type="button"
            onClick={onDeactivate}
            disabled={saving}
            className={`min-h-12 w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60 active:scale-[0.99] ${
              confirmingAction === 'deactivate'
                ? 'bg-red-600 text-white'
                : 'border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}
          >
            {saving
              ? 'Guardando...'
              : confirmingAction === 'deactivate'
                ? 'Confirmar inactivacion'
                : 'Inactivar y quitar de casa'}
          </button>
        </div>
      )}
    </article>
  )
}

function ResidentsSkeleton() {
  return (
    <section className="space-y-3">
      {[0, 1, 2].map((item) => (
        <article key={item} className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="h-5 w-36 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="h-7 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-4 w-44 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-40 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
        </article>
      ))}
    </section>
  )
}

function getStatusLabel(status: ResidentStatus) {
  if (status === 'approved') {
    return 'Aprobado'
  }

  if (status === 'rejected') {
    return 'Rechazado'
  }

  if (status === 'inactive') {
    return 'Inactivo'
  }

  return 'Pendiente'
}

function getResidentStatusTone(status: ResidentStatus) {
  if (status === 'approved') return 'green'
  if (status === 'rejected') return 'red'
  if (status === 'inactive') return 'slate'
  return 'amber'
}
