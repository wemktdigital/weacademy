import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen, 
  Users, 
  Award, 
  Star, 
  Play, 
  Clock, 
  User,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Globe,
  Zap,
  Stethoscope,
  Heart,
  Shield,
  Target
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 py-20">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary" className="w-fit">
                  <Stethoscope className="h-3 w-3 mr-1" />
                  Plataforma Exclusiva para Médicos
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
                  Transforme sua{' '}
                  <span className="text-primary">prática médica</span>{' '}
                  com conhecimento especializado
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl">
                  A WE Academy oferece cursos e treinamentos exclusivos para médicos clientes da WE Marketing Médico. 
                  Desenvolva suas habilidades clínicas e de gestão com especialistas renomados.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild>
                  <Link href="/courses">
                    Explorar Cursos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/demo">
                    <Play className="mr-2 h-4 w-4" />
                    Ver Demo
                  </Link>
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-8 pt-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">500+</div>
                  <div className="text-sm text-muted-foreground">Médicos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">50+</div>
                  <div className="text-sm text-muted-foreground">Cursos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">98%</div>
                  <div className="text-sm text-muted-foreground">Satisfação</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative z-10 bg-background rounded-2xl shadow-2xl p-8">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Stethoscope className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Marketing Médico Digital</h3>
                      <p className="text-sm text-muted-foreground">Dr. Maria Santos</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">4.9 (1.2k avaliações)</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>20h</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>150 médicos</span>
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button className="w-full">
                      Começar Agora
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 h-24 w-24 bg-primary/20 rounded-full blur-xl"></div>
              <div className="absolute -bottom-4 -left-4 h-32 w-32 bg-secondary/20 rounded-full blur-xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Por que escolher a WE Academy?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Desenvolvida especificamente para médicos, oferecemos treinamentos 
              especializados com foco na prática clínica e gestão médica.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Stethoscope className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Conteúdo Médico Especializado</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Cursos desenvolvidos especificamente para médicos, com foco 
                  em casos clínicos reais e atualizações médicas.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Marketing Médico Digital</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Aprenda estratégias de marketing digital específicas para 
                  profissionais da saúde e construção de autoridade médica.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Certificações Médicas</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Certificados reconhecidos pelo CRM e instituições médicas, 
                  válidos para pontuação em programas de educação continuada.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Comunidade Médica</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Conecte-se com outros médicos, compartilhe experiências 
                  e construa uma rede profissional sólida.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Suporte Especializado</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Suporte técnico especializado em marketing médico e 
                  mentoria com especialistas da área.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Conteúdo Atualizado</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Conteúdo sempre atualizado com as últimas tendências 
                  em medicina e marketing digital médico.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Popular Courses Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Cursos Mais Procurados
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Descubra os cursos mais procurados pelos nossos médicos clientes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Course Card 1 */}
            <Card className="group hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 rounded-t-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button size="icon" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
                <Badge className="absolute top-4 left-4">Mais Popular</Badge>
              </div>
              <CardHeader>
                <CardTitle className="line-clamp-2">Marketing Médico Digital</CardTitle>
                <CardDescription className="line-clamp-2">
                  Estratégias completas de marketing digital para médicos e clínicas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">4.9 (150)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>20h</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>150 médicos</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">R$ 497,00</div>
                    <div className="text-sm text-muted-foreground line-through">R$ 697,00</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Course Card 2 */}
            <Card className="group hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-green-500 to-blue-600 rounded-t-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button size="icon" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
                <Badge className="absolute top-4 left-4" variant="secondary">Gratuito</Badge>
              </div>
              <CardHeader>
                <CardTitle className="line-clamp-2">Gestão de Consultório</CardTitle>
                <CardDescription className="line-clamp-2">
                  Aprenda a gerenciar seu consultório de forma eficiente e lucrativa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">4.8 (89)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>15h</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>89 médicos</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">Gratuito</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Course Card 3 */}
            <Card className="group hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-purple-500 to-pink-600 rounded-t-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button size="icon" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
                <Badge className="absolute top-4 left-4">Novo</Badge>
              </div>
              <CardHeader>
                <CardTitle className="line-clamp-2">Telemedicina e Consultas Online</CardTitle>
                <CardDescription className="line-clamp-2">
                  Implemente consultas online e expanda seu atendimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">4.9 (67)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>12h</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>67 médicos</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">R$ 297,00</div>
                    <div className="text-sm text-muted-foreground line-through">R$ 397,00</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <Button size="lg" variant="outline" asChild>
              <Link href="/courses">
                Ver Todos os Cursos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}