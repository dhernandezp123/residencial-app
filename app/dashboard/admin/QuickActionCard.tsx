'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

type QuickActionCardProps = {
  href: string
  icon: LucideIcon
  title: string
  subtitle: string
}

export function QuickActionCard({
  href,
  icon: Icon,
  title,
  subtitle,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-24 items-center gap-3 rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-200/70 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800/85 dark:shadow-black/20"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF6F0] text-[#15936A] shadow-inner">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-950 dark:text-white">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-4 text-slate-500 dark:text-slate-400">
          {subtitle}
        </span>
      </span>
    </Link>
  )
}
