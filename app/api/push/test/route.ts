import { NextRequest, NextResponse } from 'next/server'
import { sendPushToProfile } from '@/lib/server/push'

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_PUSH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 503 })
  }

  if (request.headers.get('x-internal-push-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { profileId?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { profileId } = body
  if (typeof profileId !== 'string' || !profileId.trim()) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  }

  await sendPushToProfile(profileId.trim(), {
    title: 'Prueba de notificación',
    body: 'Si recibes esto, Web Push está funcionando correctamente.',
    url: '/dashboard/notifications',
  })

  return NextResponse.json({ success: true })
}
