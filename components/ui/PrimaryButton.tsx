'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
}

export function PrimaryButton({
  children,
  className = 'min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition-all duration-200 disabled:opacity-60 active:scale-[0.99] dark:bg-slate-700',
  type = 'button',
  ...props
}: PrimaryButtonProps) {
  return (
    <button type={type} className={className} {...props}>
      {children}
    </button>
  )
}
