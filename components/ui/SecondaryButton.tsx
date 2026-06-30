'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  loading?: boolean
  loadingText?: string
}

export function SecondaryButton({
  children,
  className = '',
  loading = false,
  loadingText,
  type = 'button',
  disabled,
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] dark:border-slate-600 dark:text-slate-200 ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-200" />
          {loadingText || 'Guardando...'}
        </>
      ) : (
        children
      )}
    </button>
  )
}
