import { NextRequest, NextResponse } from 'next/server'
import { sendPushToProfile, type PushPayload } from '@/lib/server/push'

// This endpoint is server-to-server only.
// Callers must present the INTERNAL_PUSH_SECRET in the x-internal-push-secret header.
// Never call this from client-side code — the secret cannot be kept private in the browser.
export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_PUSH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 503 })
  }

  const incomingSecret = request.headers.get('x-internal-push-secret')
  if (incomingSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { profileIds, payload } = body as {
    profileIds?: unknown
    payload?: unknown
  }

  if (
    !Array.isArray(profileIds) ||
    profileIds.some((id) => typeof id !== 'string') ||
    typeof payload !== 'object' ||
    payload === null
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { title, body: payloadBody, url } = payload as Record<string, unknown>

  if (
    typeof title !== 'string' ||
    typeof payloadBody !== 'string' ||
    typeof url !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const pushPayload: PushPayload = { title, body: payloadBody, url }

  await Promise.all(
    (profileIds as string[]).map((profileId) =>
      sendPushToProfile(profileId, pushPayload).catch((err) => {
        console.error('push/send route: unhandled error for profile', profileId, err)
      }),
    ),
  )

  return NextResponse.json({ ok: true })
}
