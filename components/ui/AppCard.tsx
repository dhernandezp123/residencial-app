import type { ElementType, ReactNode } from 'react'

type AppCardProps = {
  children: ReactNode
  as?: ElementType
  className?: string
}

export function AppCard({
  children,
  as: Component = 'section',
  className = 'rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800',
}: AppCardProps) {
  return <Component className={className}>{children}</Component>
}
