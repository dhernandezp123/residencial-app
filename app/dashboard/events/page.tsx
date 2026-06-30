'use client'

import { PageHeader } from '@/app/components/PageHeader'

export const dynamic = 'force-dynamic'

export default function EventsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 dark:bg-slate-900">
      <div className="mx-auto max-w-sm space-y-5">
        <PageHeader title="Eventos" />

        <section className="rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-slate-800">
          <h1 className="text-xl font-bold text-slate-950 dark:text-white">
            Eventos estará disponible próximamente.
          </h1>
        </section>
      </div>
    </main>
  )
}
