import type { ElementType, ReactNode } from 'react'

type GlassCardProps = {
  children: ReactNode
  as?: ElementType
  className?: string
}

export function GlassCard({
  children,
  as: Component = 'section',
  className = 'rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-200/70 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/85 dark:shadow-black/20',
}: GlassCardProps) {
  return <Component className={className}>{children}</Component>
}
