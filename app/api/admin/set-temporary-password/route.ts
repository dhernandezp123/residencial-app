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

type SetPasswordBody = {
  profileId?: unknown
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

  const body = (await request.json().catch(() => ({}))) as SetPasswordBody
  const profileId = normalizeText(body.profileId)
  const password = normalizeText(body.password)

  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contrasena temporal debe tener al menos 6 caracteres' },
      { status: 400 },
    )
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

  const { error: passwordError } = await admin.auth.admin.updateUserById(
    target.user_id,
    { password },
  )

  if (passwordError) {
    console.error('set-temporary-password: update error', passwordError)
    return NextResponse.json({ error: passwordError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
