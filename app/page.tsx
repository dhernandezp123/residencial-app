import Link from 'next/link'
import Image from 'next/image'

const modules = [
  {
    title: "Residenciales",
    description: "Alta y administración de comunidades, casas y perfiles.",
    metric: "Multi-tenant",
  },
  {
    title: "Visitas",
    description: "Invitaciones con tokens UUID y reglas por fecha.",
    metric: "QR seguro",
  },
  {
    title: "Garita",
    description: "Validación de ingresos, egresos y bitácora operativa.",
    metric: "Tiempo real",
  },
];

const phases = [
  "Base multi-residencial",
  "Visitas y códigos QR",
  "Registro de acceso",
  "RLS y auditoría",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#EAF6F0] text-[#14231C]">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">

        <header className="flex items-center justify-between border-b border-[#c2e0d4] pb-5">
          <div>
            <Image
              src="/branding/logos/residentpass-lockup.svg"
              alt="ResidentPass"
              width={200}
              height={32}
              className="h-8 w-auto"
              unoptimized
            />
            <h1 className="mt-2 text-2xl font-semibold text-[#14231C]">
              Acceso seguro para tu residencial
            </h1>
          </div>
          <Link
            href="/login"
            className="hidden rounded-xl bg-[#15936A] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0E6B4E] sm:inline-flex"
          >
            Iniciar sesión
          </Link>
        </header>

        <Link
          href="/login"
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#15936A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0E6B4E] sm:hidden"
        >
          Iniciar sesión
        </Link>

        <div className="grid flex-1 gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0E6B4E]">
              Plataforma QR segura
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight text-[#14231C] sm:text-5xl lg:text-6xl">
              Gestiona visitas, garita y auditoría desde una base preparada para crecer.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#2a4a3a]">
              Controla visitantes, accesos y seguridad de tu residencial desde
              una sola aplicación.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#15936A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0E6B4E]"
                href="/register"
              >
                Solicitar acceso
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center rounded-xl border border-[#9ecfbb] bg-white px-5 text-sm font-semibold text-[#14231C] transition-colors hover:bg-[#d4ede3]"
                href="/login"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>

          <aside
            id="arquitectura"
            className="rounded-xl border border-[#b8d9ca] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-[#d4ede3] pb-4">
              <h3 className="text-lg font-semibold text-[#14231C]">Modelo inicial</h3>
              <span className="rounded-md bg-[#EAF6F0] px-3 py-1 text-xs font-semibold text-[#0E6B4E]">
                Supabase
              </span>
            </div>
            <dl className="mt-5 grid gap-4">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-sm font-medium text-[#4a7a62]">Tenant</dt>
                <dd className="text-sm font-semibold text-[#14231C]">residentials</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-sm font-medium text-[#4a7a62]">Base</dt>
                <dd className="text-sm font-semibold text-[#14231C]">houses, profiles</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-sm font-medium text-[#4a7a62]">Accesos</dt>
                <dd className="text-sm font-semibold text-[#14231C]">visits, qr_tokens, visitor_entries</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-sm font-medium text-[#4a7a62]">Roles</dt>
                <dd className="text-sm font-semibold text-[#14231C]">super_admin, admin, resident, guard</dd>
              </div>
            </dl>
          </aside>
        </div>

        <section id="modulos" className="grid gap-4 pb-10 md:grid-cols-3">
          {modules.map((module) => (
            <article
              className="rounded-xl border border-[#b8d9ca] bg-white p-5 shadow-sm"
              key={module.title}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#15936A]">
                {module.metric}
              </p>
              <h3 className="mt-4 text-xl font-semibold text-[#14231C]">{module.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#4a7a62]">
                {module.description}
              </p>
            </article>
          ))}
        </section>

        <section className="border-t border-[#c2e0d4] py-6">
          <ol className="grid gap-3 text-sm font-medium text-[#2a4a3a] sm:grid-cols-2 lg:grid-cols-4">
            {phases.map((phase, index) => (
              <li
                className="flex items-center gap-3 rounded-xl bg-white px-4 py-3"
                key={phase}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF6F0] text-xs font-bold text-[#0E6B4E]">
                  {index + 1}
                </span>
                {phase}
              </li>
            ))}
          </ol>
        </section>

      </section>
    </main>
  );
}
