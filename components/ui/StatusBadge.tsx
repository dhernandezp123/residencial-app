import type { ReactNode } from 'react'

type StatusTone = 'green' | 'red' | 'amber' | 'slate' | 'blue' | 'violet'

type StatusBadgeProps = {
  children: ReactNode
  tone?: StatusTone
  className?: string
}

const toneClass: Record<StatusTone, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  violet:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
}

export function StatusBadge({
  children,
  tone = 'slate',
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={
        className ||
        `rounded-full px-3 py-1 text-xs font-semibold ${toneClass[tone]}`
      }
    >
      {children}
    </span>
  )
}
