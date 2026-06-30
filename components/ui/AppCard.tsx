import type { ElementType, ReactNode } from 'react'

type AppCardProps = {
  children: ReactNode
  as?: ElementType
  className?: string
}

export function AppCard({
  children,
  as: Component = 'section',
  className = '',
}: AppCardProps) {
  return (
    <Component
      className={`rounded-2xl bg-white p-6 shadow-sm transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-lg dark:bg-slate-800 ${className}`}
    >
      {children}
    </Component>
  )
}
