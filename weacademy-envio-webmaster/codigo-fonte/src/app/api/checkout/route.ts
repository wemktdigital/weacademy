import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { courseId, userId } = await request.json()

    if (!courseId || !userId) {
      return NextResponse.json(
        { error: 'courseId e userId são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar curso
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, price')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      return NextResponse.json(
        { error: 'Curso não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se já está inscrito
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single()

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'Você já está inscrito neste curso' },
        { status: 400 }
      )
    }

    // Para curso gratuito, inscrever diretamente
    if (course.price === 0) {
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('enrollments')
        .insert({
          user_id: userId,
          course_id: courseId,
          status: 'active',
        })
        .select()
        .single()

      if (enrollmentError) {
        return NextResponse.json(
          { error: 'Erro ao inscrever no curso' },
          { status: 400 }
        )
      }

      return NextResponse.json({ 
        enrollment,
        redirect_url: null 
      })
    }

    // Para curso pago, criar sessão do Stripe
    // Nota: Esta é uma implementação simplificada
    // Em produção, você deveria usar o SDK do Stripe
    const stripeKey = process.env.STRIPE_SECRET_KEY
    
    if (!stripeKey) {
      return NextResponse.json(
        { error: 'Stripe não configurado' },
        { status: 500 }
      )
    }

    // TODO: Implementar criação de sessão do Stripe
    // Por enquanto, retornar mock
    return NextResponse.json({
      session_id: 'mock_session_id',
      redirect_url: `/my-courses`,
      message: 'Em breve, integração com Stripe será implementada'
    })

  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar checkout' },
      { status: 500 }
    )
  }
}
