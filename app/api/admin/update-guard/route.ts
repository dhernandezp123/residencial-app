import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AdminRole = 'super_admin' | 'admin' | 'resident' | 'guard'
type ProfileStatus = 'approved' | 'inactive'

type ProfileRow = {
  id: string
  user_id: string
  role: AdminRole
  status: string
  residential_id: string | null
  is_residential_admin: boolean | null
}

type UpdateGuardBody = {
  profileId?: unknown
  residentialId?: unknown
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  status?: unknown
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function canManageResidential(actor: ProfileRow, residentialId: string): boolean {
  return (
    actor.role === 'super_admin' ||
    ((actor.role === 'admin' || Boolean(actor.is_residential_admin)) &&
      Boolean(actor.residential_id) &&
      actor.residential_id === residentialId)
  )
}

export async function PATCH(request: NextRequest) {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!jwt) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(jwt)

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: actorData, error: actorError } = await admin
    .from('profiles')
    .select('id,user_id,role,status,residential_id,is_residential_admin')
    .eq('user_id', user.id)
    .single()

  if (actorError || !actorData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const actor = actorData as ProfileRow

  if (
    actor.status !== 'approved' ||
    !(
      actor.role === 'super_admin' ||
      actor.role === 'admin' ||
      actor.is_residential_admin
    )
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as UpdateGuardBody
  const profileId = normalizeText(body.profileId)
  const firstName = normalizeText(body.firstName)
  const lastName = normalizeText(body.lastName)
  const phone = normalizeText(body.phone)
  const requestedStatus = normalizeText(body.status) as ProfileStatus
  const requestedResidentialId = normalizeText(body.residentialId)

  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  }

  if (!firstName || !lastName || !phone) {
    return NextResponse.json(
      { error: 'Nombre, apellido y telefono son requeridos' },
      { status: 400 },
    )
  }

  if (!['approved', 'inactive'].includes(requestedStatus)) {
    return NextResponse.json({ error: 'Estado no valido' }, { status: 400 })
  }

  const { data: targetData, error: targetError } = await admin
    .from('profiles')
    .select('id,user_id,role,status,residential_id,is_residential_admin')
    .eq('id', profileId)
    .single()

  if (targetError || !targetData || targetData.role !== 'guard') {
    return NextResponse.json({ error: 'Guardia no encontrado' }, { status: 404 })
  }

  const target = targetData as ProfileRow

  if (!target.residential_id || !canManageResidential(actor, target.residential_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const nextResidentialId =
    actor.role === 'super_admin' ? requestedResidentialId : target.residential_id

  if (!nextResidentialId || !canManageResidential(actor, nextResidentialId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: updatedData, error: updateError } = await admin
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      phone,
      residential_id: nextResidentialId,
      status: requestedStatus,
    })
    .eq('id', profileId)
    .eq('role', 'guard')
    .select(
      'id,user_id,first_name,last_name,phone,status,residential_id,access_email,uses_internal_email',
    )
    .single()

  if (updateError || !updatedData) {
    console.error('update-guard: update error', updateError)
    return NextResponse.json(
      { error: 'No se pudo actualizar el guardia' },
      { status: 500 },
    )
  }

  return NextResponse.json({ guard: updatedData })
}
