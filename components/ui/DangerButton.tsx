'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type DangerButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  loading?: boolean
  loadingText?: string
}

export function DangerButton({
  children,
  className = '',
  loading = false,
  loadingText,
  type = 'button',
  disabled,
  ...props
}: DangerButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white transition-all duration-200 ease-out hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          {loadingText || 'Guardando...'}
        </>
      ) : (
        children
      )}
    </button>
  )
}
