import { NextRequest, NextResponse } from 'next/server'
import { createCourseSchema, listCoursesSchema } from '@/lib/validations'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Função auxiliar para verificar autenticação via token
async function verifyAuth(request: NextRequest) {
  try {
    // Tentar obter o token do header Authorization
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return { user: null, error: 'No token provided' }
    }

    // Criar cliente Supabase com o token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    const { data, error } = await supabase.auth.getUser(token)
    
    if (error || !data.user) {
      return { user: null, error: error?.message || 'Invalid token' }
    }

    return { user: data.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

// GET /api/courses - Listar cursos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Validar query params
    const params = listCoursesSchema.parse({
      category: searchParams.get('category') || undefined,
      instructor: searchParams.get('instructor') || undefined,
      status: searchParams.get('status') || undefined,
      level: searchParams.get('level') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let query = supabase
      .from('courses')
      .select(`
        *,
        category:categories(*),
        instructor:profiles!instructor_id(id, full_name, avatar_url)
      `)

    // Aplicar filtros
    if (params.category) {
      query = query.eq('category_id', params.category)
    }
    if (params.instructor) {
      query = query.eq('instructor_id', params.instructor)
    }
    if (params.status) {
      query = query.eq('status', params.status)
    }
    if (params.level) {
      query = query.eq('level', params.level)
    }
    if (params.search) {
      query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`)
    }

    // Paginação
    const from = (params.page - 1) * params.limit
    const to = from + params.limit - 1
    
    query = query.range(from, to).order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      courses: data || [],
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count || 0,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao listar cursos' },
      { status: 400 }
    )
  }
}

// POST /api/courses - Criar curso
export async function POST(request: NextRequest) {
  try {
    // IMPORTANTE: Clonar o request e ler o body ANTES de qualquer autenticação
    const body = await request.json().catch(() => null);
    
    let user = null;
    
    // Tentar autenticar via header Authorization primeiro
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token) {
      // Autenticar com o token do header
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );
      
      const { data: { user: tokenUser }, error: tokenError } = await supabaseWithToken.auth.getUser(token);
      
      if (!tokenError && tokenUser) {
        user = tokenUser;
      }
    }
    
    // Se não autenticou via token, tentar via cookies
    if (!user) {
      const sb = await supabaseServer();
      const { data: { user: cookieUser }, error: authErr } = await sb.auth.getUser();
      
      if (!authErr && cookieUser) {
        user = cookieUser;
      }
    }

    if (process.env.LAB_DEBUG_AUTH === "1") {
      console.log("[LABAUTH][COURSE][POST]", { user: user?.id, hasToken: !!token, hasBody: !!body });
    }

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Buscar role na tabela profiles
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await serviceRoleSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role;

    if (!['admin', 'gestor_we', 'instructor'].includes(role)) {
      if (process.env.LAB_DEBUG_AUTH === "1") {
        console.log("[LABAUTH][COURSE][POST] Forbidden role:", role);
      }
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Validar o body que já foi lido no início da função
    if (!body) {
      return NextResponse.json({ error: 'Dados do curso não fornecidos' }, { status: 400 });
    }
    
    // Validar dados com mensagens de erro mais amigáveis
    let validatedData;
    try {
      validatedData = createCourseSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ') || validationError.message;
      
      console.error("[LABAUTH][COURSE][VALIDATION]", errors);
      
      return NextResponse.json({ 
        error: 'Dados inválidos',
        details: errors 
      }, { status: 400 });
    }

    // Verificar se slug já existe
    const { data: existingCourse } = await serviceRoleSupabase
      .from('courses')
      .select('id')
      .eq('slug', validatedData.slug)
      .single();

    if (existingCourse) {
      return NextResponse.json({ error: 'Slug já existe' }, { status: 400 });
    }

    // Criar curso
    const { data: course, error: courseError } = await serviceRoleSupabase
      .from('courses')
      .insert({
        title: validatedData.title,
        slug: validatedData.slug,
        description: validatedData.description,
        short_description: validatedData.short_description,
        thumbnail_url: validatedData.thumbnail_url,
        video_url: validatedData.video_url,
        video_provider: validatedData.video_provider,
        price: validatedData.price,
        is_free: validatedData.is_free,
        status: validatedData.status,
        level: validatedData.level,
        duration_hours: validatedData.duration_hours,
        category_id: validatedData.category_id,
        instructor_id: validatedData.instructor_id || user.id,
      })
      .select()
      .single();

    if (courseError) {
      console.error("[LABAUTH][COURSE][DBERR]", courseError);
      return NextResponse.json({ error: courseError.message }, { status: 400 });
    }

    // Criar módulos e lições
    for (const moduleData of validatedData.modules) {
      const { data: module, error: moduleError } = await serviceRoleSupabase
        .from('modules')
        .insert({
          course_id: course.id,
          title: moduleData.title,
          description: moduleData.description,
          order_index: moduleData.order_index,
        })
        .select()
        .single();

      if (moduleError) {
        await serviceRoleSupabase.from('courses').delete().eq('id', course.id);
        return NextResponse.json({ error: 'Erro ao criar módulo: ' + moduleError.message }, { status: 400 });
      }

      for (const lessonData of moduleData.lessons) {
        const { error: lessonError } = await serviceRoleSupabase
          .from('lessons')
          .insert({
            module_id: module.id,
            title: lessonData.title,
            description: lessonData.description,
            type: lessonData.type,
            content: lessonData.content,
            video_url: lessonData.video_url,
            video_provider: lessonData.video_provider,
            attachments: lessonData.attachments || [],
            duration_minutes: lessonData.duration_minutes,
            is_preview: lessonData.is_preview,
            is_free: lessonData.is_free,
            order_index: lessonData.order_index,
          });

        if (lessonError) {
          return NextResponse.json({ error: 'Erro ao criar lição: ' + lessonError.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json({ course }, { status: 201 });
  } catch (error: any) {
    console.error("[LABAUTH][COURSE][ERROR]", error.message);
    return NextResponse.json({ error: error.message || 'Erro ao criar curso' }, { status: 400 });
  }
}
