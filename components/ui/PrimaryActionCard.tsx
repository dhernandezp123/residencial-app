import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

type PrimaryActionCardProps = {
  href: string
  icon: LucideIcon
  title: string
  subtitle: string
  className?: string
  iconClassName?: string
  titleClassName?: string
  subtitleClassName?: string
}

export function PrimaryActionCard({
  href,
  icon: Icon,
  title,
  subtitle,
  className = 'group flex min-h-40 flex-col justify-between overflow-hidden rounded-3xl bg-[#15936A] p-4 text-white shadow-xl shadow-emerald-950/25 transition-all duration-200 hover:scale-[0.98] active:scale-95',
  iconClassName = 'flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-md shadow-emerald-950/10 backdrop-blur-xl',
  titleClassName = 'block text-xl font-black leading-tight',
  subtitleClassName = 'mt-1 block text-xs font-medium leading-4 text-white/80',
}: PrimaryActionCardProps) {
  return (
    <Link href={href} className={className}>
      <span className={iconClassName}>
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <span>
        <span className={titleClassName}>{title}</span>
        <span className={subtitleClassName}>{subtitle}</span>
      </span>
    </Link>
  )
}
