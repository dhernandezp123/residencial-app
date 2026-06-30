'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  BarChart3,
  Bell,
  BellOff,
  Camera,
  CalendarDays,
  ClipboardList,
  Package,
  Home,
  MessageSquareWarning,
  Plus,
  Shield,
  Building2,
  Smartphone,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  getPushSubscription,
  subscribeToPushNotifications,
} from '@/lib/push'
import { PwaInstallHint } from '@/app/components/PwaInstallHint'

type Profile = {
  id: string
  first_name: string
  last_name: string
  role: 'super_admin' | 'admin' | 'resident' | 'guard'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
  user_id: string
  residential_id: string | null
  is_residential_admin: boolean | null
}

const roleLabels: Record<Profile['role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  resident: 'Residente',
  guard: 'Guardia',
}

const roleBadgeClass: Record<Profile['role'], string> = {
  super_admin: 'bg-violet-500/20 text-violet-300',
  admin: 'bg-blue-500/20 text-blue-300',
  resident: 'bg-emerald-500/20 text-emerald-300',
  guard: 'bg-amber-500/20 text-amber-300',
}

export default function HomePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('id,first_name,last_name,role,status,user_id,residential_id,is_residential_admin')
        .eq('user_id', sessionData.session.user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }

    void loadProfile()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-300 dark:bg-slate-600" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </main>
    )
  }

  if (!profile || profile.status !== 'approved') {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6 flex items-center justify-center">
        <div className="mx-auto max-w-sm w-full rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-2xl">
            ⏳
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Acceso pendiente</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Tu usuario aún no ha sido aprobado por administración.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 w-full rounded-2xl bg-slate-950 dark:bg-slate-700 py-3 font-semibold text-white active:scale-[0.99]"
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 px-5 py-6">
      <div
        className={`mx-auto max-w-sm space-y-3 ${
          profile.role === 'resident' ? 'pb-28' : ''
        }`}
      >

        {/* Profile card */}
        <div className="rounded-2xl bg-[#14231C] p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Bienvenido
              </p>
              <h1 className="mt-1 text-xl font-bold leading-tight truncate">
                {profile.first_name} {profile.last_name}
              </h1>
              <span
                className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass[profile.role]}`}
              >
                {profile.role === 'resident' && profile.is_residential_admin
                  ? 'Residente + Admin'
                  : roleLabels[profile.role]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex-shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/20 active:scale-[0.97] transition-colors"
            >
              Salir
            </button>
          </div>
        </div>

        <PwaInstallHint />

        {/* Role dashboards */}
        {profile.role === 'super_admin' && (
          <SuperAdminDashboard onLogout={handleLogout} />
        )}
        {(profile.role === 'admin' || profile.is_residential_admin) && (
          <AdminDashboard onLogout={handleLogout} />
        )}
        {profile.role === 'resident' && (
          <ResidentDashboard
            profileId={profile.id}
            residentialId={profile.residential_id}
            onLogout={handleLogout}
          />
        )}
        {profile.role === 'guard' && (
          <GuardDashboard onLogout={handleLogout} />
        )}

      </div>
    </main>
  )
}

function SuperAdminDashboard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="space-y-3">
      <DashboardButton
        icon={BarChart3}
        title="Dashboard administración"
        subtitle="KPIs y resumen global del sistema"
        href="/dashboard/admin"
      />
      <DashboardButton
        icon={Building2}
        title="Residenciales"
        subtitle="Crear y administrar residenciales"
        href="/dashboard/residentials"
      />
      <DashboardButton
        icon={Home}
        title="Casas"
        subtitle="Ver casas, seguridad y ocupación"
        href="/dashboard/houses"
      />
      <DashboardButton
        icon={UserCheck}
        title="Residentes"
        subtitle="Aprobar, revisar y quitar usuarios"
        href="/dashboard/residents"
      />
      <DashboardButton
        icon={Shield}
        title="Guardias"
        subtitle="Administrar seguridad por residencial"
        href="/dashboard/guards"
      />
      <DashboardButton
        icon={MessageSquareWarning}
        title="Quejas e incidentes"
        subtitle="Revisar reportes de residentes"
        href="/dashboard/reports"
      />
      <DashboardButton
        icon={UserCog}
        title="Administradores"
        subtitle="Asignar admins por residencial"
        comingSoon
      />
      <LogoutButton onLogout={onLogout} />
    </div>
  )
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="space-y-3">
      <DashboardButton
        icon={BarChart3}
        title="Dashboard administración"
        subtitle="KPIs y resumen del residencial"
        href="/dashboard/admin"
      />
      <DashboardButton
        icon={Home}
        title="Casas"
        subtitle="Registrar lotes y casas"
        href="/dashboard/houses"
      />
      <DashboardButton
        icon={UserCheck}
        title="Residentes pendientes"
        subtitle="Aprobar vecinos"
        href="/dashboard/residents"
      />
      <DashboardButton
        icon={Shield}
        title="Guardias"
        subtitle="Crear usuarios de seguridad"
        href="/dashboard/guards"
      />
      <DashboardButton
        icon={MessageSquareWarning}
        title="Quejas e incidentes"
        subtitle="Dar seguimiento a reportes"
        href="/dashboard/reports"
      />
      <LogoutButton onLogout={onLogout} />
    </div>
  )
}

function ResidentDashboard({
  profileId,
  residentialId,
  onLogout,
}: {
  profileId: string
  residentialId: string | null
  onLogout: () => void
}) {
  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8.75rem,1fr))] gap-3">
          <PrimaryResidentActionCard
            icon={Plus}
            title="Visita"
            subtitle="Invitado personal"
            href="/dashboard/visits/new?mode=visit"
          />
          <PrimaryResidentActionCard
            icon={Package}
            title="Delivery"
            subtitle="Comida y paquetes"
            href="/dashboard/visits/new?mode=delivery"
          />
          <PrimaryResidentActionCard
            icon={CalendarDays}
            title="Evento"
            subtitle="Invitaciones grupales"
            href="/dashboard/events"
          />
        </div>

        <PushNotificationButton
          profileId={profileId}
          residentialId={residentialId}
        />

        <div className="pb-3">
          <LogoutButton onLogout={onLogout} />
        </div>
      </div>

      <MobileNavigation />
    </>
  )
}

function PrimaryResidentActionCard({
  icon: Icon,
  title,
  subtitle,
  href,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-36 flex-col justify-between overflow-hidden rounded-3xl bg-[#15936A] p-4 text-white shadow-lg shadow-emerald-900/20 transition-transform active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-sm backdrop-blur-xl">
        <Icon className="h-6 w-6" />
      </span>
      <span>
        <span className="block text-lg font-black leading-tight">{title}</span>
        <span className="mt-1 block text-xs font-medium leading-4 text-white/80">
          {subtitle}
        </span>
      </span>
    </Link>
  )
}

function MobileNavigation() {
  const pathname = usePathname()
  const items: {
    href: string
    label: string
    icon: LucideIcon
  }[] = [
    { href: '/dashboard/visits', label: 'Mis visitas', icon: ClipboardList },
    { href: '/dashboard/my-house', label: 'Mi casa', icon: Home },
    { href: '/dashboard/notifications', label: 'Notificaciones', icon: Bell },
    {
      href: '/dashboard/reports',
      label: 'Quejas y sugerencias',
      icon: MessageSquareWarning,
    },
  ]

  return (
    <nav
      aria-label="Navegación residente"
      className="fixed bottom-4 left-4 right-4 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-sm items-center justify-around rounded-full border border-white/70 bg-white/85 px-3 py-2 shadow-lg shadow-slate-900/15 backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors active:scale-95 ${
                active ? 'bg-slate-100 text-[#15936A]' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function ResidentNotificationCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
  disabled,
  muted,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  onClick?: () => void
  disabled?: boolean
  muted?: boolean
}) {
  const content = (
    <div className="flex min-h-20 items-center gap-3 text-left">
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/60 text-[#15936A] shadow-sm backdrop-blur-xl">
        <Icon className={`h-5 w-5 ${muted ? 'text-slate-400' : ''}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight text-slate-950 dark:text-white">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-4 text-slate-600 dark:text-slate-300">
          {subtitle}
        </span>
      </span>
    </div>
  )

  const className = `w-full rounded-3xl border border-white/60 bg-white/75 p-3 shadow-lg shadow-slate-200/60 backdrop-blur-xl transition-transform dark:border-white/10 dark:bg-white/10 dark:shadow-black/20 ${
    disabled ? 'cursor-default opacity-75' : 'active:scale-[0.99]'
  }`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

function GuardDashboard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="space-y-3">
      <DashboardButton
        icon={Camera}
        title="Escanear QR"
        subtitle="Validar acceso de visitantes"
        href="/gate/scan"
        highlight
      />
      <DashboardButton
        icon={ClipboardList}
        title="Entradas recientes"
        subtitle="Ver ingresos registrados"
        href="/dashboard/entries"
      />
      <DashboardButton
        icon={Users}
        title="Personas dentro"
        subtitle="Ver visitantes actualmente dentro"
        href="/dashboard/inside"
      />
      <LogoutButton onLogout={onLogout} />
    </div>
  )
}

function PushNotificationButton({
  profileId,
  residentialId,
}: {
  profileId: string
  residentialId: string | null
}) {
  const [checking, setChecking] = useState(true)
  const [supported, setSupported] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    const checkSubscription = async () => {
      const hasNotification = 'Notification' in window
      const hasSW = 'serviceWorker' in navigator
      const hasPush = 'PushManager' in window
      const pushSupported = hasNotification && hasSW && hasPush

      const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true


      setIsIOS(iosDevice)
      setIsStandalone(standalone)

      if (!pushSupported) {
        setChecking(false)
        return
      }

      setSupported(true)
      setPermissionDenied(Notification.permission === 'denied')

      let sub: PushSubscription | null = null
      if (Notification.permission !== 'denied') {
        sub = await getPushSubscription()
        setIsSubscribed(Boolean(sub))
      }

      setChecking(false)
    }
    void checkSubscription()
  }, [])

  const handleActivate = async () => {
    if (!('Notification' in window)) {
      toast.error('Tu navegador no soporta notificaciones push')
      return
    }
    setActivating(true)

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setPermissionDenied(permission === 'denied')
      toast.error('Permiso de notificaciones no otorgado')
      setActivating(false)
      return
    }

    let subscription: PushSubscription
    try {
      subscription = await subscribeToPushNotifications()
    } catch (err) {
      console.error('Error subscribing to push notifications:', err)
      toast.error('No se pudieron activar las notificaciones')
      setActivating(false)
      return
    }

    const json = subscription.toJSON()
    const p256dh = json.keys?.['p256dh']
    const auth = json.keys?.['auth']

    if (!p256dh || !auth) {
      toast.error('No se pudo obtener las claves de la suscripción')
      setActivating(false)
      return
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        profile_id: profileId,
        residential_id: residentialId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: 'endpoint', ignoreDuplicates: true },
    )

    if (error) {
      console.error('Error saving push subscription:', error)
      toast.error('No se pudo guardar la suscripción')
      setActivating(false)
      return
    }

    setIsSubscribed(true)
    toast.success('Notificaciones activadas correctamente')
    setActivating(false)
  }

  // Still checking browser capabilities — don't flash anything
  if (checking) {
    return (
      <ResidentNotificationCard
        icon={Bell}
        title="Notificaciones"
        subtitle="Revisando estado"
        disabled
      />
    )
  }

  // iOS detected but not installed as PWA → push requires standalone mode
  if (isIOS && !isStandalone) {
    return (
      <ResidentNotificationCard
        icon={Smartphone}
        title="Instalar app"
        subtitle="Requerido en iPhone"
        disabled
      />
    )
  }

  if (!supported) {
    return (
      <ResidentNotificationCard
        icon={BellOff}
        title="No disponibles"
        subtitle="Este navegador no soporta"
        disabled
        muted
      />
    )
  }

  if (permissionDenied) {
    return (
      <ResidentNotificationCard
        icon={BellOff}
        title="Bloqueadas"
        subtitle="Revisa navegador"
        disabled
        muted
      />
    )
  }

  if (isSubscribed) {
    return null
  }

  if (!activating) {
    return (
      <ResidentNotificationCard
        icon={Bell}
        title="Activar notificaciones"
        subtitle="Avisos de accesos"
        onClick={handleActivate}
      />
    )
  }

  if (activating) {
    return (
      <ResidentNotificationCard
        icon={Bell}
        title="Activando..."
        subtitle="Avisos de accesos"
        disabled
      />
    )
  }

  if (isIOS && !isStandalone) {
    return (
      <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 shadow-sm">
        <div className="flex gap-3">
          <span className="flex-shrink-0 rounded-xl bg-blue-100 dark:bg-blue-800/50 p-2 text-blue-600 dark:text-blue-400">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight text-blue-900 dark:text-blue-100">
              Activa notificaciones en iPhone
            </p>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Para activar notificaciones en iPhone, agrega esta app a la pantalla de inicio y ábrela desde ahí.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Push API not available in this browser
  if (!supported) {
    return (
      <div className="flex min-h-[4.5rem] w-full items-center gap-4 rounded-2xl bg-slate-200 dark:bg-slate-700 p-4 opacity-60 shadow-sm">
        <span className="flex-shrink-0 rounded-xl bg-slate-300 dark:bg-slate-600 p-2 text-slate-400">
          <BellOff className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight text-slate-500 dark:text-slate-400">
            Notificaciones no disponibles
          </p>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
            Notificaciones no disponibles en este navegador
          </p>
        </div>
      </div>
    )
  }

  // User previously blocked notifications
  if (permissionDenied) {
    return (
      <div className="flex min-h-[4.5rem] w-full items-center gap-4 rounded-2xl bg-slate-200 dark:bg-slate-700 p-4 shadow-sm">
        <span className="flex-shrink-0 rounded-xl bg-slate-300 dark:bg-slate-600 p-2 text-slate-400">
          <BellOff className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight text-slate-600 dark:text-slate-300">
            Notificaciones bloqueadas
          </p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Actívalas desde la configuración del navegador
          </p>
        </div>
      </div>
    )
  }

  // Already subscribed
  if (isSubscribed) {
    return (
      <div className="flex min-h-[4.5rem] w-full items-center gap-4 rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm">
        <span className="flex-shrink-0 rounded-xl bg-green-100 dark:bg-green-900/30 p-2 text-green-600 dark:text-green-400">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight text-slate-900 dark:text-white">
            Notificaciones activas
          </p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Recibirás avisos de entradas y salidas
          </p>
        </div>
        <span className="flex-shrink-0 text-lg text-green-500">✓</span>
      </div>
    )
  }

  // Default: permission not yet requested
  return (
    <button
      type="button"
      onClick={handleActivate}
      disabled={activating}
      className="flex min-h-[4.5rem] w-full items-center gap-4 rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm disabled:opacity-60 active:scale-[0.99] transition-transform"
    >
      <span className="flex-shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700 p-2 text-slate-600 dark:text-slate-300">
        <Bell className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-semibold leading-tight text-slate-900 dark:text-white">
          {activating ? 'Activando...' : 'Activar notificaciones'}
        </p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Recibe avisos cuando tus visitas entren o salgan
        </p>
      </div>
      <span className="flex-shrink-0 text-lg text-slate-300 dark:text-slate-500">›</span>
    </button>
  )
}

function DashboardButton({
  icon: Icon,
  title,
  subtitle,
  href,
  highlight,
  comingSoon,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  href?: string
  highlight?: boolean
  comingSoon?: boolean
}) {
  const content = (
    <div className="flex items-center gap-4">
      <span className={`flex-shrink-0 rounded-xl p-2 ${comingSoon ? 'bg-slate-300 dark:bg-slate-600 text-slate-400' : highlight ? 'bg-white/15 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className={`font-semibold leading-tight ${comingSoon ? 'text-slate-400 dark:text-slate-500' : highlight ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
          {title}
        </p>
        <p className={`mt-0.5 text-sm ${comingSoon ? 'text-slate-400 dark:text-slate-500' : highlight ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
          {subtitle}
        </p>
      </div>
      {comingSoon ? (
        <span className="flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-600 px-2 py-0.5 text-xs font-semibold text-slate-400 dark:text-slate-300">
          Pronto
        </span>
      ) : (
        <span className={`flex-shrink-0 text-lg ${highlight ? 'text-white/60' : 'text-slate-300 dark:text-slate-500'}`}>›</span>
      )}
    </div>
  )

  const baseClass = `block w-full rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-transform min-h-[4.5rem] ${
    comingSoon
      ? 'bg-slate-200 dark:bg-slate-700 cursor-default opacity-60'
      : highlight
        ? 'bg-[#15936A]'
        : 'bg-white dark:bg-slate-800'
  }`

  if (href && !comingSoon) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    )
  }

  return (
    <div className={baseClass}>
      {content}
    </div>
  )
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(timer)
  }, [confirming])

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    onLogout()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`min-h-12 w-full rounded-2xl px-4 py-3 font-semibold text-white active:scale-[0.99] transition-colors ${
        confirming
          ? 'bg-red-700 hover:bg-red-800'
          : 'bg-red-600 hover:bg-red-700'
      }`}
    >
      {confirming ? '¿Confirmar cierre de sesión?' : 'Cerrar sesión'}
    </button>
  )
}
