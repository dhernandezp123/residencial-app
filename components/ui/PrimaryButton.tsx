'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  loading?: boolean
  loadingText?: string
}

export function PrimaryButton({
  children,
  className = '',
  loading = false,
  loadingText,
  type = 'button',
  disabled,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] dark:bg-slate-700 ${className}`}
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
