import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await supabaseServer()
    
    const { data: template, error } = await supabase
      .from('lab_pipeline_templates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template não encontrado' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error fetching pipeline template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

