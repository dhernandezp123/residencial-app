'use client'

import {
  CalendarDays,
  CheckCircle2,
  LogIn,
  LogOut,
  PackageCheck,
  ReceiptText,
  UserPlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ActivityKind =
  | 'visit_entry'
  | 'visit_exit'
  | 'delivery'
  | 'event'
  | 'resident_registration'
  | 'resident_approval'
  | 'receipt'

export type ActivityItem = {
  id: string
  kind: ActivityKind
  title: string
  description: string
  occurredAt: string
}

const activityMeta: Record<
  ActivityKind,
  { icon: LucideIcon; label: string; className: string }
> = {
  visit_entry: {
    icon: LogIn,
    label: 'Ingreso visita',
    className: 'bg-[#EAF6F0] text-[#15936A]',
  },
  visit_exit: {
    icon: LogOut,
    label: 'Salida visita',
    className: 'bg-slate-100 text-slate-600',
  },
  delivery: {
    icon: PackageCheck,
    label: 'Delivery',
    className: 'bg-blue-100 text-blue-700',
  },
  event: {
    icon: CalendarDays,
    label: 'Evento',
    className: 'bg-emerald-100 text-emerald-700',
  },
  resident_registration: {
    icon: UserPlus,
    label: 'Registro residente',
    className: 'bg-violet-100 text-violet-700',
  },
  resident_approval: {
    icon: CheckCircle2,
    label: 'Aprobacion residente',
    className: 'bg-[#EAF6F0] text-[#15936A]',
  },
  receipt: {
    icon: ReceiptText,
    label: 'Comprobante cargado',
    className: 'bg-amber-100 text-amber-700',
  },
}

function formatActivityTime(value: string): string {
  return new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-6 text-sm leading-6 text-slate-500 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
        Aun no hay actividad reciente para mostrar.
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-200/70 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/85 dark:shadow-black/20">
      <ol className="space-y-1">
        {items.map((item, index) => {
          const meta = activityMeta[item.kind]
          const Icon = meta.icon

          return (
            <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index !== items.length - 1 && (
                <span
                  className="absolute left-5 top-11 h-[calc(100%-2.75rem)] w-px bg-slate-200 dark:bg-slate-700"
                  aria-hidden="true"
                />
              )}
              <span
                className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.className}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    {meta.label}
                  </span>
                  <time className="text-[11px] font-semibold text-slate-400">
                    {formatActivityTime(item.occurredAt)}
                  </time>
                </span>
                <p className="mt-1 text-sm font-bold leading-5 text-slate-950 dark:text-white">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {item.description}
                </p>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
