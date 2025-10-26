import { z } from 'zod'

// Schema para verificar certificado (query params)
export const verifyCertificateSchema = z.object({
  certificate_number: z.string().min(1, 'Número do certificado é obrigatório'),
})

// Schema para certificado (retorno)
export const certificateSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  course_id: z.string().uuid(),
  certificate_number: z.string(),
  qr_code_url: z.string().url().nullable(),
  issued_at: z.date(),
  verified_at: z.date().nullable(),
  certificate_url: z.string().url().nullable(),
  metadata: z.record(z.any()).optional(),
})

// Schema para gerar certificado
export const generateCertificateSchema = z.object({
  user_id: z.string().uuid(),
  course_id: z.string().uuid(),
})

// Schema para download de certificado PDF
export const downloadCertificateSchema = z.object({
  certificate_number: z.string().min(1),
  format: z.enum(['pdf', 'png']).default('pdf'),
})

// Types
export type VerifyCertificateInput = z.infer<typeof verifyCertificateSchema>
export type Certificate = z.infer<typeof certificateSchema>
export type GenerateCertificateInput = z.infer<typeof generateCertificateSchema>
export type DownloadCertificateInput = z.infer<typeof downloadCertificateSchema>
