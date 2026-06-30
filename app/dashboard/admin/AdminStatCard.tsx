'use client'

import type { LucideIcon } from 'lucide-react'
import { GlassCard } from '@/components/ui'

type AdminStatCardProps = {
  icon: LucideIcon
  label: string
  value: number
  helper?: string
  tone?: 'green' | 'slate' | 'amber' | 'blue'
}

const toneClasses: Record<
  NonNullable<AdminStatCardProps['tone']>,
  { icon: string; iconBg: string; value: string }
> = {
  green: {
    icon: 'text-[#15936A]',
    iconBg: 'bg-[#EAF6F0]',
    value: 'text-[#15936A]',
  },
  slate: {
    icon: 'text-slate-600',
    iconBg: 'bg-slate-100',
    value: 'text-slate-950',
  },
  amber: {
    icon: 'text-amber-700',
    iconBg: 'bg-amber-100',
    value: 'text-amber-700',
  },
  blue: {
    icon: 'text-blue-700',
    iconBg: 'bg-blue-100',
    value: 'text-blue-700',
  },
}

export function AdminStatCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = 'green',
}: AdminStatCardProps) {
  const colors = toneClasses[tone]

  return (
    <GlassCard
      as="article"
      className="min-h-32 rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-200/70 backdrop-blur-xl transition-all duration-200 hover:shadow-md active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800/85 dark:shadow-black/20"
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${colors.iconBg} shadow-inner dark:bg-slate-700`}
      >
        <Icon className={`h-5 w-5 ${colors.icon}`} aria-hidden="true" />
      </div>
      <p className={`mt-4 text-3xl font-black leading-none ${colors.value} dark:text-white`}>
        {value}
      </p>
      <h2 className="mt-2 text-sm font-bold leading-5 text-slate-800 dark:text-slate-100">
        {label}
      </h2>
      {helper && (
        <p className="mt-1 text-xs leading-4 text-slate-500 dark:text-slate-400">
          {helper}
        </p>
      )}
    </GlassCard>
  )
}
