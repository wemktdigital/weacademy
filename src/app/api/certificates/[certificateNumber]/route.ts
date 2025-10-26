import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyCertificateSchema } from '@/lib/validations'

// GET /api/certificates/[certificateNumber] - Verificar certificado
export async function GET(
  request: NextRequest,
  { params }: { params: { certificateNumber: string } }
) {
  try {
    // Usar função RPC do Supabase
    const { data, error } = await supabase
      .rpc('verify_certificate', { cert_number: params.certificateNumber })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Certificado não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ certificate: data[0] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao verificar certificado' },
      { status: 400 }
    )
  }
}
