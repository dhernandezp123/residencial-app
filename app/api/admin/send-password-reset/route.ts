import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AdminRole = 'super_admin' | 'admin' | 'resident' | 'guard'

type ProfileRow = {
  id: string
  user_id: string
  role: AdminRole
  status: string
  residential_id: string | null
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
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

  const { profileId } = (await request.json().catch(() => ({}))) as {
    profileId?: unknown
  }

  if (typeof profileId !== 'string' || !profileId.trim()) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  }

  const { data: actorData, error: actorError } = await admin
    .from('profiles')
    .select('id,user_id,role,status,residential_id')
    .eq('user_id', user.id)
    .single()

  if (actorError || !actorData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const actor = actorData as ProfileRow

  if (
    actor.status !== 'approved' ||
    !['admin', 'super_admin'].includes(actor.role)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: targetData, error: targetError } = await admin
    .from('profiles')
    .select('id,user_id,role,status,residential_id')
    .eq('id', profileId.trim())
    .single()

  if (targetError || !targetData) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const target = targetData as ProfileRow

  const canReset =
    actor.role === 'super_admin' ||
    (actor.role === 'admin' &&
      target.role !== 'super_admin' &&
      Boolean(actor.residential_id) &&
      actor.residential_id === target.residential_id)

  if (!canReset) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: targetUserData, error: targetUserError } =
    await admin.auth.admin.getUserById(target.user_id)

  if (targetUserError || !targetUserData.user?.email) {
    console.error('send-password-reset: get target user error', targetUserError)
    return NextResponse.json(
      { error: 'Target user has no email' },
      { status: 422 },
    )
  }

  const origin =
    request.headers.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin

  const { error: resetError } = await admin.auth.resetPasswordForEmail(
    targetUserData.user.email,
    {
      redirectTo: `${origin}/reset-password`,
    },
  )

  if (resetError) {
    console.error('send-password-reset: reset error', resetError)
    return NextResponse.json({ error: resetError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
