import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToProfile } from '@/lib/server/push'

type QrToken = {
  id: string
  visit_id: string
  residential_id: string
  token: string
  expires_at: string
  status: 'active' | 'used' | 'expired' | 'cancelled'
}

type Visit = {
  id: string
  residential_id: string
  house_id: string
  visitor_name: string
  access_mode: 'single_use' | 'multi_use'
  valid_until: string
  status: 'active' | 'used' | 'expired' | 'cancelled'
}

type EntryRow = {
  id: string
  entry_time: string
  exit_time: string | null
}

type HouseAccess = {
  id: string
  residential_id: string
  is_active: boolean | null
  pays_security: boolean | null
}

type ActorProfile = {
  id: string
  role: string
  status: string
  residential_id: string | null
}

type RegisterAccessBody = {
  token?: unknown
  visit_id?: unknown
  validation_method?: unknown
  identity_photo_url?: unknown
  vehicle_photo_url?: unknown
  plate_photo_url?: unknown
}

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type ServiceClient = NonNullable<ReturnType<typeof makeServiceClient>>

async function notifyResidents(params: {
  residentialId: string
  houseId: string
  actorProfileId: string
  visitId: string
  visitorEntryId: string
  type: 'visitor_entered' | 'visitor_exited'
  title: string
  message: string
}): Promise<void> {
  const db = makeServiceClient()
  if (!db) return

  const { data: residentsData, error: residentsError } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'resident')
    .eq('status', 'approved')
    .eq('house_id', params.houseId)

  if (residentsError) {
    console.error('register-access: load residents error', residentsError)
    return
  }

  const residents = (residentsData ?? []) as { id: string }[]
  if (residents.length === 0) return

  const notifications = residents.map((resident) => ({
    residential_id: params.residentialId,
    house_id: params.houseId,
    recipient_profile_id: resident.id,
    actor_profile_id: params.actorProfileId,
    visit_id: params.visitId,
    visitor_entry_id: params.visitorEntryId,
    type: params.type,
    title: params.title,
    message: params.message,
  }))

  const { error: insertError } = await db
    .from('notifications')
    .insert(notifications)
  if (insertError) {
    console.error('register-access: insert notifications error', insertError)
  }

  await Promise.all(
    residents.map((resident) =>
      sendPushToProfile(resident.id, {
        title: params.title,
        body: params.message,
        url: '/dashboard/notifications',
      }).catch((error) => {
        console.error(
          'register-access: push error for profile',
          resident.id,
          error,
        )
      }),
    ),
  )
}

function canRegisterForVisit(profile: ActorProfile, visit: Visit): boolean {
  if (profile.role === 'super_admin') return true
  if (!profile.residential_id) return false
  if (!['guard', 'admin'].includes(profile.role)) return false
  return profile.residential_id === visit.residential_id
}

function escapeRegex(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function isExpectedPhotoPath(params: {
  path: string
  kind: 'identity' | 'vehicle' | 'plate'
  visit: Visit
}): boolean {
  const pattern = new RegExp(
    `^${escapeRegex(params.visit.residential_id)}/${escapeRegex(
      params.visit.id,
    )}/${params.kind}-[a-zA-Z0-9-]+\\.(jpg|jpeg|png|webp|heic)$`,
    'i',
  )
  return pattern.test(params.path)
}

async function verifyPhotoExists(params: {
  bucket: string
  path: string
}): Promise<boolean> {
  const db = makeServiceClient()
  if (!db) return false
  const { error } = await db.storage.from(params.bucket).download(params.path)
  return !error
}

async function loadProfile(
  db: ServiceClient,
  jwt: string,
): Promise<ActorProfile | null> {
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser(jwt)
  if (userError || !user) return null

  const { data: profileData, error: profileError } = await db
    .from('profiles')
    .select('id,role,status,residential_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profileData) return null
  return profileData as ActorProfile
}

export async function POST(request: NextRequest) {
  const db = makeServiceClient()
  if (!db) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await loadProfile(db, jwt)
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (
    profile.status !== 'approved' ||
    !['guard', 'admin', 'super_admin'].includes(profile.role)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: RegisterAccessBody
  try {
    body = (await request.json()) as RegisterAccessBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    token,
    visit_id,
    validation_method,
    identity_photo_url,
    vehicle_photo_url,
    plate_photo_url,
  } = body
  const hasToken = typeof token === 'string' && token.trim().length > 0
  const hasVisitId = typeof visit_id === 'string' && visit_id.trim().length > 0
  const validationMethod =
    validation_method === 'manual_search' && hasVisitId && !hasToken
      ? 'manual_search'
      : 'qr'

  if (!hasToken && !hasVisitId) {
    return NextResponse.json(
      { error: 'token or visit_id is required' },
      { status: 400 },
    )
  }

  let qrToken: QrToken | null = null
  let visitIdToLoad = hasVisitId ? (visit_id as string).trim() : ''

  if (hasToken) {
    const { data: qrTokenData, error: qrError } = await db
      .from('qr_tokens')
      .select('id,visit_id,residential_id,token,expires_at,status')
      .eq('token', (token as string).trim())
      .single()

    if (qrError || !qrTokenData) {
      return NextResponse.json({ error: 'QR invalido' }, { status: 404 })
    }

    qrToken = qrTokenData as QrToken
    visitIdToLoad = qrToken.visit_id
  }

  const { data: visitData, error: visitError } = await db
    .from('visits')
    .select('id,residential_id,house_id,visitor_name,access_mode,valid_until,status')
    .eq('id', visitIdToLoad)
    .single()

  if (visitError || !visitData) {
    return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })
  }

  const visit = visitData as Visit

  if (qrToken && qrToken.residential_id !== visit.residential_id) {
    return NextResponse.json({ error: 'QR invalido' }, { status: 404 })
  }

  if (!canRegisterForVisit(profile, visit)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: entriesData, error: entriesError } = await db
    .from('visitor_entries')
    .select('id,entry_time,exit_time')
    .eq('visit_id', visit.id)
    .eq('entry_status', 'allowed')
    .order('entry_time', { ascending: false })

  if (entriesError) {
    console.error('register-access: entries error', entriesError)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  const entries = (entriesData ?? []) as EntryRow[]
  const openEntry = entries.find((entry) => entry.exit_time === null) ?? null
  const now = new Date()

  if (openEntry) {
    const { data: updatedEntry, error: exitError } = await db
      .from('visitor_entries')
      .update({ exit_time: now.toISOString() })
      .eq('id', openEntry.id)
      .select('id,entry_time,exit_time')
      .single()

    if (exitError) {
      console.error('register-access: exit update error', exitError)
      return NextResponse.json(
        { error: 'Error al registrar salida' },
        { status: 500 },
      )
    }

    await notifyResidents({
      residentialId: visit.residential_id,
      houseId: visit.house_id,
      actorProfileId: profile.id,
      visitId: visit.id,
      visitorEntryId: openEntry.id,
      type: 'visitor_exited',
      title: 'Visitante salio',
      message: `${visit.visitor_name} salio de tu residencia.`,
    }).catch((error) =>
      console.error('register-access: notifyResidents error', error),
    )

    return NextResponse.json({ action: 'exit', entry: updatedEntry as EntryRow })
  }

  if (visit.access_mode === 'single_use' && entries.length > 0) {
    return NextResponse.json({ error: 'QR no disponible' }, { status: 409 })
  }

  if (qrToken && qrToken.status !== 'active') {
    return NextResponse.json({ error: 'QR no disponible' }, { status: 409 })
  }

  const expiresAt = qrToken?.expires_at ?? visit.valid_until
  if (new Date(expiresAt).getTime() <= now.getTime()) {
    return NextResponse.json({ error: 'Visita vencida' }, { status: 409 })
  }

  if (visit.status !== 'active') {
    return NextResponse.json({ error: 'Visita no disponible' }, { status: 409 })
  }

  const { data: houseData, error: houseError } = await db
    .from('houses')
    .select('id,residential_id,is_active,pays_security')
    .eq('id', visit.house_id)
    .eq('residential_id', visit.residential_id)
    .single()

  if (houseError || !houseData) {
    return NextResponse.json({ error: 'Casa no disponible' }, { status: 409 })
  }

  const house = houseData as HouseAccess
  if (house.is_active !== true || house.pays_security !== true) {
    return NextResponse.json({ error: 'Casa sin acceso activo' }, { status: 409 })
  }

  if (
    typeof identity_photo_url !== 'string' ||
    !identity_photo_url.trim() ||
    typeof vehicle_photo_url !== 'string' ||
    !vehicle_photo_url.trim() ||
    typeof plate_photo_url !== 'string' ||
    !plate_photo_url.trim()
  ) {
    return NextResponse.json(
      { error: 'Se requieren las 3 evidencias fotograficas' },
      { status: 400 },
    )
  }

  const identityPhotoPath = identity_photo_url.trim()
  const vehiclePhotoPath = vehicle_photo_url.trim()
  const platePhotoPath = plate_photo_url.trim()

  const validPhotoPaths =
    isExpectedPhotoPath({
      path: identityPhotoPath,
      kind: 'identity',
      visit,
    }) &&
    isExpectedPhotoPath({
      path: vehiclePhotoPath,
      kind: 'vehicle',
      visit,
    }) &&
    isExpectedPhotoPath({
      path: platePhotoPath,
      kind: 'plate',
      visit,
    })

  if (!validPhotoPaths) {
    return NextResponse.json(
      { error: 'Evidencia fotografica invalida' },
      { status: 400 },
    )
  }

  const [identityExists, vehicleExists, plateExists] = await Promise.all([
    verifyPhotoExists({
      bucket: 'visitor-identities',
      path: identityPhotoPath,
    }),
    verifyPhotoExists({
      bucket: 'visitor-vehicles',
      path: vehiclePhotoPath,
    }),
    verifyPhotoExists({
      bucket: 'visitor-plates',
      path: platePhotoPath,
    }),
  ])

  if (!identityExists || !vehicleExists || !plateExists) {
    return NextResponse.json(
      { error: 'No se encontro la evidencia fotografica requerida' },
      { status: 400 },
    )
  }

  const { data: insertedEntry, error: entryError } = await db
    .from('visitor_entries')
    .insert({
      residential_id: visit.residential_id,
      visit_id: visit.id,
      qr_token_id: qrToken?.id ?? null,
      house_id: visit.house_id,
      guard_id: profile.id,
      entry_status: 'allowed',
      validation_method: validationMethod,
      notes: null,
      identity_photo_url: identityPhotoPath,
      vehicle_photo_url: vehiclePhotoPath,
      plate_photo_url: platePhotoPath,
    })
    .select('id,entry_time,exit_time')
    .single()

  if (entryError || !insertedEntry) {
    console.error('register-access: insert entry error', entryError)
    return NextResponse.json(
      { error: 'Error al registrar ingreso' },
      { status: 500 },
    )
  }

  if (visit.access_mode === 'single_use') {
    const usedAt = now.toISOString()
    await Promise.all([
      db
        .from('qr_tokens')
        .update({ status: 'used', used_at: usedAt })
        .eq('visit_id', visit.id)
        .eq('status', 'active'),
      db.from('visits').update({ status: 'used' }).eq('id', visit.id),
    ])
  }

  const newEntry = insertedEntry as EntryRow

  await notifyResidents({
    residentialId: visit.residential_id,
    houseId: visit.house_id,
    actorProfileId: profile.id,
    visitId: visit.id,
    visitorEntryId: newEntry.id,
    type: 'visitor_entered',
    title: 'Visitante ingreso',
    message: `${visit.visitor_name} ingreso a tu residencia.`,
  }).catch((error) =>
    console.error('register-access: notifyResidents error', error),
  )

  return NextResponse.json({ action: 'entry', entry: newEntry })
}
