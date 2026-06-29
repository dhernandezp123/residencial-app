import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type ExpiringVisit = {
  id: string
  residential_id: string
  house_id: string
  visitor_name: string
  valid_until: string
}

type ResidentRow = {
  id: string
  house_id: string
}

type ExistingNotificationRow = {
  visit_id: string | null
}

type NotificationInsert = {
  residential_id: string
  house_id: string
  recipient_profile_id: string
  actor_profile_id: null
  visit_id: string
  visitor_entry_id: null
  type: 'visit_expiring'
  title: string
  message: string
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 503 },
    )
  }

  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null
    const headerSecret = request.headers.get('x-cron-secret')

    if (bearer !== cronSecret && headerSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.error('[visit-expiring] Missing NEXT_PUBLIC_SUPABASE_URL')
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL' },
      { status: 500 },
    )
  }

  // TODO: Set SUPABASE_SERVICE_ROLE_KEY in your environment variables (Vercel dashboard
  //       or .env.local) to activate this cron endpoint. The service role key is required
  //       because cron requests have no authenticated session, so the anon key + RLS
  //       would block all queries. Until the key is present this route is a safe no-op.
  if (!serviceRoleKey) {
    return NextResponse.json(
      { skipped: true, reason: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
      { status: 200 },
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now = new Date()
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  // 1. Find active visits expiring in the next 2 hours
  const { data: visitsData, error: visitsError } = await admin
    .from('visits')
    .select('id,residential_id,house_id,visitor_name,valid_until')
    .eq('status', 'active')
    .gt('valid_until', now.toISOString())
    .lte('valid_until', windowEnd.toISOString())

  if (visitsError) {
    console.error('[visit-expiring] Error loading expiring visits:', visitsError)
    return NextResponse.json({ error: visitsError.message }, { status: 500 })
  }

  const expiringVisits = (visitsData ?? []) as ExpiringVisit[]

  if (expiringVisits.length === 0) {
    return NextResponse.json({ notified: 0 })
  }

  const visitIds = expiringVisits.map((v) => v.id)

  // 2. Exclude visits that already have a visit_expiring notification
  const { data: existingData, error: existingError } = await admin
    .from('notifications')
    .select('visit_id')
    .eq('type', 'visit_expiring')
    .in('visit_id', visitIds)

  if (existingError) {
    console.error(
      '[visit-expiring] Error checking existing notifications:',
      existingError,
    )
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const alreadyNotified = new Set(
    ((existingData ?? []) as ExistingNotificationRow[])
      .map((n) => n.visit_id)
      .filter((id): id is string => Boolean(id)),
  )

  const pendingVisits = expiringVisits.filter((v) => !alreadyNotified.has(v.id))

  if (pendingVisits.length === 0) {
    return NextResponse.json({ notified: 0 })
  }

  // 3. Batch-load approved residents for all relevant houses
  const houseIds = Array.from(new Set(pendingVisits.map((v) => v.house_id)))

  const { data: residentsData, error: residentsError } = await admin
    .from('profiles')
    .select('id,house_id')
    .eq('role', 'resident')
    .eq('status', 'approved')
    .in('house_id', houseIds)

  if (residentsError) {
    console.error('[visit-expiring] Error loading residents:', residentsError)
    return NextResponse.json({ error: residentsError.message }, { status: 500 })
  }

  const residents = (residentsData ?? []) as ResidentRow[]

  // Group resident ids by house_id for fast lookup
  const residentsByHouse = new Map<string, string[]>()
  for (const resident of residents) {
    const list = residentsByHouse.get(resident.house_id) ?? []
    list.push(resident.id)
    residentsByHouse.set(resident.house_id, list)
  }

  // 4. Build one notification per resident per pending visit
  const notifications: NotificationInsert[] = pendingVisits.flatMap((visit) => {
    const houseResidents = residentsByHouse.get(visit.house_id) ?? []
    return houseResidents.map((recipientId) => ({
      residential_id: visit.residential_id,
      house_id: visit.house_id,
      recipient_profile_id: recipientId,
      actor_profile_id: null,
      visit_id: visit.id,
      visitor_entry_id: null,
      type: 'visit_expiring' as const,
      title: 'Visita por vencer',
      message: `El acceso de ${visit.visitor_name} está por vencer.`,
    }))
  })

  if (notifications.length === 0) {
    return NextResponse.json({ notified: 0 })
  }

  const { error: insertError } = await admin
    .from('notifications')
    .insert(notifications)

  if (insertError) {
    console.error('[visit-expiring] Error inserting notifications:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ notified: notifications.length })
}
