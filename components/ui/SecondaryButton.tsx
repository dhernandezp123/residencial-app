'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
}

export function SecondaryButton({
  children,
  className = 'min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 disabled:opacity-60 active:scale-[0.99] dark:border-slate-600 dark:text-slate-200',
  type = 'button',
  ...props
}: SecondaryButtonProps) {
  return (
    <button type={type} className={className} {...props}>
      {children}
    </button>
  )
}
