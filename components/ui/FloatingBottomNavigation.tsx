import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export type FloatingBottomNavigationItem = {
  href: string
  label: string
  ariaLabel: string
  icon: LucideIcon
}

type FloatingBottomNavigationProps = {
  items: FloatingBottomNavigationItem[]
  activeHref: string
  ariaLabel?: string
  className?: string
  containerClassName?: string
}

export function FloatingBottomNavigation({
  items,
  activeHref,
  ariaLabel = 'Navegacion',
  className = 'fixed bottom-4 left-4 right-4 z-50',
  containerClassName = 'mx-auto flex max-w-sm items-center justify-around rounded-full border border-white/70 bg-white/85 px-3 py-2 shadow-lg shadow-slate-900/15 backdrop-blur-xl',
}: FloatingBottomNavigationProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={className}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className={containerClassName}>
        {items.map((item) => {
          const Icon = item.icon
          const active = activeHref === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.ariaLabel}
              title={item.ariaLabel}
              className={`flex h-14 min-w-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 transition-all duration-200 active:scale-95 ${
                active ? 'bg-[#EAF6F0] text-[#15936A]' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="whitespace-nowrap text-[10px] font-semibold leading-none">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
