import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AdminRole = 'super_admin' | 'admin' | 'resident' | 'guard'

type ProfileRow = {
  id: string
  user_id: string
  role: AdminRole
  status: string
  residential_id: string | null
  is_residential_admin: boolean | null
}

type CreateGuardBody = {
  residentialId?: unknown
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  email?: unknown
  password?: unknown
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

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function canManageResidential(actor: ProfileRow, residentialId: string): boolean {
  return (
    actor.role === 'super_admin' ||
    ((actor.role === 'admin' || Boolean(actor.is_residential_admin)) &&
      Boolean(actor.residential_id) &&
      actor.residential_id === residentialId)
  )
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json().catch(() => ({}))) as CreateGuardBody
  const requestedResidentialId = normalizeText(body.residentialId)
  const residentialId =
    actor.role === 'super_admin' ? requestedResidentialId : actor.residential_id || ''
  const firstName = normalizeText(body.firstName)
  const lastName = normalizeText(body.lastName)
  const phone = normalizeText(body.phone)
  const email = normalizeEmail(body.email)
  const password = normalizeText(body.password)

  if (!residentialId) {
    return NextResponse.json(
      { error: 'Selecciona un residencial' },
      { status: 400 },
    )
  }

  if (!canManageResidential(actor, residentialId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!firstName || !lastName || !phone) {
    return NextResponse.json(
      { error: 'Nombre, apellido y telefono son requeridos' },
      { status: 400 },
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contrasena temporal debe tener al menos 6 caracteres' },
      { status: 400 },
    )
  }

  const { data: residentialData, error: residentialError } = await admin
    .from('residentials')
    .select('id,name,is_active')
    .eq('id', residentialId)
    .single()

  if (residentialError || !residentialData || residentialData.is_active === false) {
    return NextResponse.json(
      { error: 'Residencial no disponible' },
      { status: 404 },
    )
  }

  const usesInternalEmail = !email
  const phoneDigits = phone.replace(/\D/g, '').slice(-8) || 'sin-telefono'
  const residentialSlug = slugify(residentialData.name || 'residencial')
  const accessEmail = usesInternalEmail
    ? `guard.${residentialSlug}.${phoneDigits}.${randomUUID().slice(0, 8)}@residentpass.local`
    : email

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email: accessEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'guard',
      },
    })

  if (createUserError || !createdUser.user) {
    console.error('create-guard: auth user error', createUserError)
    return NextResponse.json(
      { error: createUserError?.message || 'No se pudo crear el usuario' },
      { status: 400 },
    )
  }

  const { data: profileData, error: profileError } = await admin
    .from('profiles')
    .insert({
      user_id: createdUser.user.id,
      residential_id: residentialId,
      first_name: firstName,
      last_name: lastName,
      phone,
      role: 'guard',
      status: 'approved',
      is_residential_admin: false,
      access_email: accessEmail,
      uses_internal_email: usesInternalEmail,
    })
    .select(
      'id,user_id,first_name,last_name,phone,status,residential_id,access_email,uses_internal_email',
    )
    .single()

  if (profileError || !profileData) {
    console.error('create-guard: profile error', profileError)
    await admin.auth.admin.deleteUser(createdUser.user.id)
    return NextResponse.json(
      { error: 'No se pudo crear el perfil del guardia' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    guard: profileData,
    accessEmail,
    usesInternalEmail,
  })
}
