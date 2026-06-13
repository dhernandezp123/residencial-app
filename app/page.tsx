const modules = [
  {
    title: "Residenciales",
    description: "Alta y administracion de comunidades, casas y perfiles.",
    metric: "Multi-tenant",
  },
  {
    title: "Visitas",
    description: "Invitaciones con tokens UUID y reglas por fecha.",
    metric: "QR seguro",
  },
  {
    title: "Garita",
    description: "Validacion de ingresos, egresos y bitacora operativa.",
    metric: "Tiempo real",
  },
];

const phases = [
  "Base multi-residencial",
  "Visitas y codigos QR",
  "Registro de acceso",
  "RLS y auditoria",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f7f2] text-[#1f2722]">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#d7d6cc] pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#607064]">
              Residencial Access
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              Control de acceso residencial
            </h1>
          </div>
          <div className="hidden rounded-md border border-[#c8c7bd] bg-white px-4 py-2 text-sm font-medium text-[#49554c] sm:block">
            Base SaaS multi-residencial
          </div>
        </header>

        <div className="grid flex-1 gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7a5f37]">
              Plataforma QR segura
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight text-[#18211c] sm:text-5xl lg:text-6xl">
              Gestiona visitas, garita y auditoria desde una base preparada para crecer.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#59635b]">
              El sistema inicia con estructura multi-residencial, roles claros y
              datos listos para protegerse con RLS en Supabase.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex h-12 items-center justify-center rounded-md bg-[#24382c] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#314d3c]"
                href="#modulos"
              >
                Ver modulos
              </a>
              <a
                className="inline-flex h-12 items-center justify-center rounded-md border border-[#b9b8ad] bg-white px-5 text-sm font-semibold text-[#24382c] transition-colors hover:bg-[#eeede6]"
                href="#arquitectura"
              >
                Ver arquitectura
              </a>
            </div>
          </div>

          <aside
            id="arquitectura"
            className="border border-[#d2d0c4] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-[#e3e1d8] pb-4">
              <h3 className="text-lg font-semibold">Modelo inicial</h3>
              <span className="rounded-md bg-[#edf3ef] px-3 py-1 text-xs font-semibold text-[#345442]">
                Supabase
              </span>
            </div>
            <dl className="mt-5 grid gap-4">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-sm font-medium text-[#6c756e]">
                  Tenant
                </dt>
                <dd className="text-sm font-semibold">residentials</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-sm font-medium text-[#6c756e]">Base</dt>
                <dd className="text-sm font-semibold">houses, profiles</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-sm font-medium text-[#6c756e]">
                  Accesos
                </dt>
                <dd className="text-sm font-semibold">
                  visits, qr_tokens, visitor_entries
                </dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-sm font-medium text-[#6c756e]">Roles</dt>
                <dd className="text-sm font-semibold">
                  super_admin, admin, resident, guard
                </dd>
              </div>
            </dl>
          </aside>
        </div>

        <section id="modulos" className="grid gap-4 pb-10 md:grid-cols-3">
          {modules.map((module) => (
            <article
              className="rounded-md border border-[#d2d0c4] bg-white p-5 shadow-sm"
              key={module.title}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7a5f37]">
                {module.metric}
              </p>
              <h3 className="mt-4 text-xl font-semibold">{module.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#59635b]">
                {module.description}
              </p>
            </article>
          ))}
        </section>

        <section className="border-t border-[#d7d6cc] py-6">
          <ol className="grid gap-3 text-sm font-medium text-[#49554c] sm:grid-cols-2 lg:grid-cols-4">
            {phases.map((phase, index) => (
              <li
                className="flex items-center gap-3 rounded-md bg-white px-4 py-3"
                key={phase}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e7dcc9] text-xs font-bold text-[#60481f]">
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
