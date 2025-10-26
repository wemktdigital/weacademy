import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'
import { renderToStream } from '@react-pdf/renderer'

// Critérios para emissão de certificado
const MIN_AGENT_EXECUTIONS = 10
const MIN_MESSAGES = 50

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verificar se usuário já tem certificado
    const { data: existingCert } = await supabase
      .from('lab_certificates')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingCert) {
      return NextResponse.json({
        error: 'User already has a certificate',
        certificateId: existingCert.id,
      }, { status: 400 })
    }

    // Verificar critérios
    const { count: agentCount } = await supabase
      .from('lab_agent_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { count: messageCount } = await supabase
      .from('lab_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', user.id) // Simplificado - ajustar conforme necessário

    if ((agentCount || 0) < MIN_AGENT_EXECUTIONS || (messageCount || 0) < MIN_MESSAGES) {
      return NextResponse.json({
        error: 'Criteria not met',
        required: {
          agentExecutions: MIN_AGENT_EXECUTIONS,
          messages: MIN_MESSAGES,
        },
        current: {
          agentExecutions: agentCount || 0,
          messages: messageCount || 0,
        },
      }, { status: 400 })
    }

    // Buscar dados do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    const userName = profile?.full_name || profile?.email || 'Usuário'
    const certificateDate = new Date().toLocaleDateString('pt-BR')

    // Criar URL do certificado (por enquanto apenas salvar metadata)
    const certificateData = {
      user_id: user.id,
      title: 'Certificado de Conclusão - Laboratório de IA',
      url: `/lab-ia/certificates/${user.id}`, // Página de visualização
    }

    const { data: certificate, error: certError } = await supabase
      .from('lab_certificates')
      .insert(certificateData)
      .select()
      .single()

    if (certError) {
      throw certError
    }

    return NextResponse.json({
      success: true,
      certificate: {
        id: certificate.id,
        title: certificate.title,
        issuedAt: certificate.issued_at,
      },
      message: 'Certificate generated successfully',
    })
  } catch (error) {
    console.error('Error generating certificate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET para verificar elegibilidade
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verificar se já tem certificado
    const { data: existingCert } = await supabase
      .from('lab_certificates')
      .select('id, issued_at')
      .eq('user_id', user.id)
      .single()

    if (existingCert) {
      return NextResponse.json({
        hasCertificate: true,
        certificateId: existingCert.id,
        issuedAt: existingCert.issued_at,
      })
    }

    // Calcular progresso
    const { count: agentCount } = await supabase
      .from('lab_agent_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { count: messageCount } = await supabase
      .from('lab_messages')
      .select('*', { count: 'exact', head: true })

    const progress = {
      agentExecutions: agentCount || 0,
      messages: messageCount || 0,
      required: {
        agentExecutions: MIN_AGENT_EXECUTIONS,
        messages: MIN_MESSAGES,
      },
      eligible: (agentCount || 0) >= MIN_AGENT_EXECUTIONS && (messageCount || 0) >= MIN_MESSAGES,
    }

    return NextResponse.json({
      hasCertificate: false,
      progress,
    })
  } catch (error) {
    console.error('Error checking certificate eligibility:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
