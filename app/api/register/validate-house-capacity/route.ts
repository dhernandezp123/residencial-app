import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type ValidateBody = {
  house_id?: unknown
}

type HouseRow = {
  id: string
  is_active: boolean
  pays_security: boolean
  resident_limit: number | null
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'validate-house-capacity: missing env vars',
      !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY',
    )
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'missing_service_role' },
      { status: 503 },
    )
  }

  let body: ValidateBody = {}
  try {
    body = (await request.json()) as ValidateBody
  } catch {
    console.error('validate-house-capacity: invalid JSON body')
  }

  const houseId = typeof body.house_id === 'string' ? body.house_id.trim() : ''

  if (!houseId) {
    console.error('validate-house-capacity: house_id missing or not a string', body.house_id)
    return NextResponse.json(
      { error: 'missing_house_id', canRegister: false, reason: 'house_id requerido' },
      { status: 400 },
    )
  }

  const { data: house, error: houseError } = await admin
    .from('houses')
    .select('id,is_active,pays_security,resident_limit')
    .eq('id', houseId)
    .single<HouseRow>()

  if (houseError || !house) {
    console.error('validate-house-capacity: house_query_failed', houseId, houseError)
    return NextResponse.json(
      { error: 'house_query_failed', canRegister: false, reason: 'Casa no encontrada' },
      { status: 404 },
    )
  }

  if (!house.is_active) {
    return NextResponse.json(
      { canRegister: false, reason: 'La casa no está activa' },
      { status: 200 },
    )
  }

  if (!house.pays_security) {
    return NextResponse.json(
      { canRegister: false, reason: 'La casa no tiene seguridad activa' },
      { status: 200 },
    )
  }

  const residentLimit = house.resident_limit ?? 3

  const { count, error: countError } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('house_id', houseId)
    .eq('role', 'resident')
    .eq('status', 'approved')

  if (countError) {
    console.error('validate-house-capacity: profiles_count_failed', countError)
    return NextResponse.json(
      { error: 'profiles_count_failed', canRegister: false, reason: 'Error al consultar cupo' },
      { status: 500 },
    )
  }

  const approvedCount = count ?? 0
  const canRegister = approvedCount < residentLimit

  return NextResponse.json({
    canRegister,
    approvedCount,
    residentLimit,
    ...(!canRegister && {
      reason: `Esta casa ya alcanzó el límite de ${residentLimit} residente${residentLimit === 1 ? '' : 's'} permitido${residentLimit === 1 ? '' : 's'}.`,
    }),
  })
}
