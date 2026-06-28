import webPush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

let vapidConfigured = false

function ensureVapidConfigured() {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webPush.setVapidDetails('mailto:soporte@dher.space', publicKey, privateKey)
  vapidConfigured = true
  return true
}

export type PushPayload = {
  title: string
  body: string
  url: string
}

export async function sendPushToProfile(
  profileId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapidConfigured()) {
    // TODO: configure NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
    return
  }

  const db = getServiceClient()
  if (!db) {
    // TODO: configure SUPABASE_SERVICE_ROLE_KEY for push sending
    return
  }

  const { data: subscriptions, error } = await db
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth')
    .eq('profile_id', profileId)

  if (error) {
    console.error('sendPushToProfile: failed to load subscriptions', error)
    return
  }

  if (!subscriptions || subscriptions.length === 0) return

  const serialized = JSON.stringify(payload)

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          serialized,
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 410 || status === 404) {
          await db
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        } else {
          console.error('sendPushToProfile: send error', err)
        }
      }
    }),
  )
}
