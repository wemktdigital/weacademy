import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/header'
import Footer from '@/components/footer'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { EventTrackingProvider } from '@/components/providers/EventTrackingProvider'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WE Academy - Transforme sua carreira com conhecimento prático',
  description: 'A plataforma de cursos online que transforma sua carreira através do aprendizado prático e inovador. Aprenda com os melhores instrutores do mercado.',
  keywords: ['cursos online', 'educação', 'programação', 'design', 'marketing digital', 'tecnologia'],
  authors: [{ name: 'WE Academy' }],
  openGraph: {
    title: 'WE Academy - Transforme sua carreira',
    description: 'A plataforma de cursos online que transforma sua carreira através do aprendizado prático e inovador.',
    type: 'website',
    locale: 'pt_BR',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <EventTrackingProvider>
              <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
              </div>
              <Toaster />
            </EventTrackingProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}