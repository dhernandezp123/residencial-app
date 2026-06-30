type SectionHeaderProps = {
  id?: string
  title: string
  subtitle?: string
  className?: string
}

export function SectionHeader({
  id,
  title,
  subtitle,
  className = 'px-1',
}: SectionHeaderProps) {
  return (
    <div className={className}>
      <h2 id={id} className="text-base font-black text-slate-950 dark:text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  )
}
