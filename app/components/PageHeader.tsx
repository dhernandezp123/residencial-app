import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function PageHeader({
  title,
  subtitle,
  backHref = '/dashboard',
}: {
  title: string
  subtitle?: string
  backHref?: string
}) {
  return (
    <header className="flex items-center gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
      <Link
        href={backHref}
        className="flex-shrink-0 rounded-xl bg-white/10 p-2 active:scale-95"
        aria-label="Volver"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0">
        <h1 className="text-lg font-bold leading-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-slate-400">{subtitle}</p>
        )}
      </div>
    </header>
  )
}
