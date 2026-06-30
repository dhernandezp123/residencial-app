import type { ReactNode } from 'react'

type PageContainerProps = {
  children: ReactNode
  className?: string
  innerClassName?: string
}

export function PageContainer({
  children,
  className = 'min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900',
  innerClassName = 'mx-auto max-w-sm space-y-5',
}: PageContainerProps) {
  return (
    <main className={className}>
      <div className={innerClassName}>{children}</div>
    </main>
  )
}
