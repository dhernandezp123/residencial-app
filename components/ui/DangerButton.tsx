'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type DangerButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
}

export function DangerButton({
  children,
  className = 'min-h-12 w-full rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white transition-all duration-200 hover:bg-red-700 disabled:opacity-60 active:scale-[0.99]',
  type = 'button',
  ...props
}: DangerButtonProps) {
  return (
    <button type={type} className={className} {...props}>
      {children}
    </button>
  )
}
