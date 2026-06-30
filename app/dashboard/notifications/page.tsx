'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bell, Clock, LogIn, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/ui'

type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'inactive'

type CurrentProfile = {
  id: string
  status: ProfileStatus
}

type NotificationType = 'visitor_entered' | 'visitor_exited' | 'visit_expiring' | 'system'

type AppNotification = {
  id: string
  type: NotificationType
  title: string
  message: string
  read_at: string | null
  created_at: string
}

type TypeMeta = {
  icon: LucideIcon
  iconBg: string
  iconColor: string
}

const typeMeta: Record<NotificationType, TypeMeta> = {
  visitor_entered: {
    icon: LogIn,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  visitor_exited: {
    icon: LogOut,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  visit_expiring: {
    icon: Clock,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  system: {
    icon: Bell,
    iconBg: 'bg-slate-100 dark:bg-slate-700',
    iconColor: 'text-slate-600 dark:text-slate-300',
  },
}

export default function NotificationsPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const loadNotifications = async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast.error('Inicia sesión para ver tus notificaciones')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,status')
      .eq('user_id', sessionData.session.user.id)
      .single()

    if (profileError || !profileData) {
      console.error('Error loading profile:', profileError)
      toast.error('No se pudo cargar tu perfil')
      setLoading(false)
      return
    }

    const currentProfile = profileData as CurrentProfile
    setProfile(currentProfile)

    if (currentProfile.status !== 'approved') {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id,type,title,message,read_at,created_at')
      .eq('recipient_profile_id', currentProfile.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading notifications:', error)
      toast.error('No se pudieron cargar las notificaciones')
      setLoading(false)
      return
    }

    setNotifications((data ?? []) as AppNotification[])
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadNotifications)
  }, [])

  const handleMarkRead = async (notificationId: string) => {
    setSavingId(notificationId)
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', notificationId)

    setSavingId(null)

    if (error) {
      console.error('Error marking notification as read:', error)
      toast.error('No se pudo marcar la notificación como leída')
      return
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read_at: now } : n)),
    )
  }

  const handleMarkAllRead = async () => {
    if (!profile) return
    const unreadCount = notifications.filter((n) => !n.read_at).length
    if (unreadCount === 0) return

    setMarkingAll(true)
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('recipient_profile_id', profile.id)
      .is('read_at', null)

    setMarkingAll(false)

    if (error) {
      console.error('Error marking all notifications as read:', error)
      toast.error('No se pudieron marcar las notificaciones como leídas')
      return
    }

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? now })),
    )
    toast.success('Notificaciones leídas')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <div className="h-4 w-32 animate-pulse rounded-full bg-slate-300 dark:bg-slate-600" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-300 dark:bg-slate-600" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700"
            />
          ))}
        </div>
      </main>
    )
  }

  if (!profile || profile.status !== 'approved') {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Acceso no disponible
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Tu cuenta aún no ha sido aprobada por administración.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 block min-h-12 rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 text-center font-semibold text-white active:scale-[0.99]"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    )
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <Link
          href="/dashboard"
          className="block text-sm font-semibold text-slate-600 dark:text-slate-300"
        >
          ← Volver al dashboard
        </Link>

        <header className="rounded-2xl bg-slate-950 dark:bg-slate-800 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Mi cuenta</p>
          <h1 className="mt-1 text-2xl font-bold">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="mt-2 text-sm text-slate-300">
              {unreadCount} notificación{unreadCount !== 1 ? 'es' : ''} nueva
              {unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </header>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="w-full min-h-12 rounded-2xl bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-60 active:scale-[0.99] transition-transform"
          >
            {markingAll ? 'Marcando...' : 'Marcar todas como leídas'}
          </button>
        )}

        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="No tienes notificaciones"
            description="Los avisos de accesos, salidas y vencimientos apareceran aqui."
          />
        ) : (
          <section className="space-y-3">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                saving={savingId === notification.id}
                onMarkRead={() => handleMarkRead(notification.id)}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function NotificationCard({
  notification,
  saving,
  onMarkRead,
}: {
  notification: AppNotification
  saving: boolean
  onMarkRead: () => void
}) {
  const meta = typeMeta[notification.type]
  const Icon = meta.icon
  const isUnread = !notification.read_at

  const formattedTime = new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(notification.created_at))

  return (
    <article
      className={`rounded-2xl p-5 shadow-sm transition-colors ${
        isUnread
          ? 'bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700'
          : 'bg-slate-50 dark:bg-slate-800/60'
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`mt-0.5 flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl ${meta.iconBg}`}
        >
          <Icon className={`h-5 w-5 ${meta.iconColor}`} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={`font-bold leading-tight truncate ${
                isUnread
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {notification.title}
            </p>
            {isUnread && (
              <span className="flex-shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                Nueva
              </span>
            )}
          </div>

          <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">
            {notification.message}
          </p>

          <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">
            {formattedTime}
          </p>

          {!isUnread && (
            <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">
              Leída
            </p>
          )}
        </div>
      </div>

      {isUnread && (
        <button
          type="button"
          onClick={onMarkRead}
          disabled={saving}
          className="mt-4 w-full min-h-10 rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60 active:scale-[0.99] transition-transform"
        >
          {saving ? 'Guardando...' : 'Marcar como leída'}
        </button>
      )}
    </article>
  )
}
