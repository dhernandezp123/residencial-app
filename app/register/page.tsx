'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Residential = {
  id: string
  name: string
}

type House = {
  id: string
  residential_id: string
  block: string
  house_number: string
  pays_security: boolean
}

type RegisterFormData = {
  firstName: string
  lastName: string
  phone: string
  email: string
  password: string
  block: string
  houseNumber: string
}

const initialFormData: RegisterFormData = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  password: '',
  block: '',
  houseNumber: '',
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-100 px-5 py-6">
          <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Registro</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Cargando invitación...
            </h1>
          </div>
        </main>
      }
    >
      <RegisterContent />
    </Suspense>
  )
}

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const residentialId = searchParams.get('residential_id') || ''

  const [residential, setResidential] = useState<Residential | null>(null)
  const [houses, setHouses] = useState<House[]>([])
  const [formData, setFormData] = useState<RegisterFormData>(initialFormData)
  const [showPassword, setShowPassword] = useState(false)
  const [loadingResidential, setLoadingResidential] = useState(Boolean(residentialId))
  const [loadingHouses, setLoadingHouses] = useState(false)
  const [saving, setSaving] = useState(false)

  const normalizedBlock = formData.block.trim().toUpperCase()
  const normalizedHouseNumber = formData.houseNumber.trim()

  const matchedHouse = useMemo(
    () =>
      houses.find(
        (house) =>
          house.block.trim().toUpperCase() === normalizedBlock &&
          house.house_number.trim() === normalizedHouseNumber
      ) || null,
    [houses, normalizedBlock, normalizedHouseNumber]
  )
  const hasCompleteHouseInput =
    normalizedBlock.length > 0 && normalizedHouseNumber.length > 0
  const hasValidResidential = Boolean(residentialId) && Boolean(residential)
  const houseLabel = hasCompleteHouseInput
    ? `${normalizedBlock}-${normalizedHouseNumber}`
    : ''
  const canSubmit =
    hasValidResidential &&
    normalizedBlock.length > 0 &&
    normalizedHouseNumber.length > 0 &&
    Boolean(matchedHouse) &&
    Boolean(matchedHouse?.pays_security)

  const loadResidential = useCallback(async () => {
    if (!residentialId) {
      setLoadingResidential(false)
      return
    }

    setLoadingResidential(true)

    const { data, error } = await supabase
      .from('residentials')
      .select('id,name')
      .eq('id', residentialId)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Error loading residential:', error)
      setResidential(null)
      setLoadingResidential(false)
      return
    }

    setResidential(data)
    setLoadingResidential(false)
  }, [residentialId])

  const loadHouses = useCallback(async (selectedResidentialId: string) => {
    if (!selectedResidentialId) {
      setHouses([])
      return
    }

    setLoadingHouses(true)

    const { data, error } = await supabase
      .from('houses')
      .select('id,residential_id,block,house_number,pays_security')
      .eq('residential_id', selectedResidentialId)
      .eq('is_active', true)

    if (error) {
      console.error('Error loading houses:', error)
      setHouses([])
      setLoadingHouses(false)
      return
    }

    setHouses(data || [])
    setLoadingHouses(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadResidential)
  }, [loadResidential])

  useEffect(() => {
    void Promise.resolve().then(() => loadHouses(residentialId))
  }, [loadHouses, residentialId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !hasValidResidential ||
      normalizedBlock.length === 0 ||
      normalizedHouseNumber.length === 0 ||
      !matchedHouse ||
      !matchedHouse.pays_security
    ) {
      return
    }

    setSaving(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password,
    })

    if (signUpError || !signUpData.user) {
      console.error('Error signing up:', signUpError)
      toast.error(signUpError?.message || 'No se pudo crear el usuario')
      setSaving(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: signUpData.user.id,
      residential_id: residentialId,
      house_id: matchedHouse.id,
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      phone: formData.phone.trim(),
      role: 'resident',
      status: 'pending',
    })

    setSaving(false)

    if (profileError) {
      console.error('Error creating profile:', profileError)

      if (!signUpData.session) {
        toast.error(
          'Revisa tu correo para confirmar la cuenta. Luego inicia sesión para completar la solicitud.'
        )
      } else {
        toast.error('No se pudo crear la solicitud de residente')
      }

      return
    }

    if (!signUpData.session) {
      toast.success(
        'Solicitud creada. Revisa tu correo para confirmar la cuenta; quedará pendiente de aprobación.'
      )
    } else {
      toast.success('Solicitud enviada. Quedó pendiente de aprobación.')
    }

    setFormData(initialFormData)
    router.push('/login')
  }

  if (!residentialId) {
    return (
      <main className="min-h-screen bg-slate-100 px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Registro de vecino
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Enlace requerido
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Necesitas un enlace de invitación válido para registrarte.
            </p>
            <Link
              href="/login"
              className="mt-6 block min-h-12 rounded-2xl bg-slate-950 px-4 py-3 text-center font-semibold text-white active:scale-[0.99]"
            >
              Volver a login
            </Link>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-sm space-y-5">
        <Link href="/login" className="block text-sm font-semibold text-slate-600">
          ← Volver a login
        </Link>

        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">Registro de vecino</p>
          <h1 className="mt-1 text-2xl font-bold">Solicitar acceso</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Tu cuenta quedará pendiente hasta que administración valide tu casa.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
        >
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">Nombre</span>
            <input
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              placeholder="Ej: Ana"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">
              Apellido
            </span>
            <input
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              placeholder="Ej: López"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">
              Teléfono
            </span>
            <input
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="Ej: 9999-9999"
              type="tel"
              inputMode="tel"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">Correo</span>
            <input
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="tu@correo.com"
              type="email"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">
              Contraseña
            </span>
            <div className="relative">
              <input
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Mínimo 6 caracteres"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  setShowPassword(!showPassword)
                }}
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </label>

          <section className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Residencial</p>
            <p className="mt-1 text-base font-bold text-slate-950">
              {loadingResidential
                ? 'Cargando residencial...'
                : residential?.name || 'Invitación no válida'}
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Lote / Bloque
              </span>
              <input
                value={formData.block}
                onChange={(e) =>
                  setFormData({ ...formData, block: e.target.value })
                }
                placeholder="Ej: D"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none"
                required
                disabled={!residential || loadingHouses}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Número
              </span>
              <input
                value={formData.houseNumber}
                onChange={(e) =>
                  setFormData({ ...formData, houseNumber: e.target.value })
                }
                placeholder="Ej: 84"
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
                required
                disabled={!residential || loadingHouses}
              />
            </label>
          </div>

          <HouseValidationCard
            hasCompleteHouseInput={hasCompleteHouseInput}
            houseLabel={houseLabel}
            loadingHouses={loadingHouses}
            matchedHouse={matchedHouse}
          />

          <button
            type="submit"
            disabled={saving || loadingResidential || loadingHouses || !canSubmit}
            className="min-h-12 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
          >
            {saving ? 'Enviando solicitud...' : 'Enviar solicitud'}
          </button>
        </form>
      </div>
    </main>
  )
}

function HouseValidationCard({
  hasCompleteHouseInput,
  houseLabel,
  loadingHouses,
  matchedHouse,
}: {
  hasCompleteHouseInput: boolean
  houseLabel: string
  loadingHouses: boolean
  matchedHouse: House | null
}) {
  if (loadingHouses) {
    return (
      <section className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
        Cargando casas del residencial...
      </section>
    )
  }

  if (!hasCompleteHouseInput) {
    return (
      <section className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
        Ingresa tu lote y número de casa para continuar.
      </section>
    )
  }

  if (!matchedHouse) {
    return (
      <section className="rounded-2xl bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
        No encontramos la casa {houseLabel}. Verifica el lote y número, o
        contacta a administración.
      </section>
    )
  }

  if (!matchedHouse.pays_security) {
    return (
      <section className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-700">
        Esta casa no tiene seguridad activa. Contacta a administración.
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-green-50 p-4 text-sm font-semibold leading-6 text-green-700">
      Casa encontrada: {houseLabel}. Puedes enviar tu solicitud.
    </section>
  )
}
