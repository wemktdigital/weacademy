import { vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * Helper robusto para mockar Supabase em testes
 * Gerencia múltiplas instâncias (com token, service role, etc.)
 * e facilita o encadeamento de chamadas
 */
export class MockSupabaseHelper {
  private queryBuilder: any
  private supabaseClient: any
  private authClient: any // Cliente com token
  private serviceRoleClient: any // Cliente com service role
  private callHistory: Array<{ type: string; method: string; args: any[] }> = []
  private createClientCallIndex: number = 0 // Rastrear ordem de chamadas

  constructor() {
    this.setupQueryBuilder()
    this.setupClients()
    this.setupCreateClientMock()
  }

  /**
   * Configura o query builder com métodos encadeáveis
   */
  private setupQueryBuilder() {
      this.queryBuilder = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      or: vi.fn(),
      range: vi.fn(),
      order: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      neq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      limit: vi.fn(),
      is: vi.fn(), // Para .is('null') usado em queries
    }

    // Todos os métodos retornam o próprio builder para encadeamento
    // IMPORTANTE: range() retorna Promise quando é o último método
    const methods = [
      'select', 'insert', 'update', 'delete', 'eq', 'in', 'or',
      'order', 'neq', 'gte', 'lte', 'maybeSingle', 'limit', 'is'
    ]
    
    methods.forEach(method => {
      this.queryBuilder[method].mockReturnValue(this.queryBuilder)
    })
    
    // range() pode retornar o builder (para encadeamento) ou Promise (quando é o último)
    // Por padrão, retorna o builder, mas pode ser sobrescrito para retornar Promise
    this.queryBuilder.range.mockReturnValue(this.queryBuilder)

    // single() pode retornar uma promise com resultado
    // Isso será configurado via mockResolvedValue ou mockResolvedValueOnce
    // IMPORTANTE: Garantir que single() sempre retorna uma Promise por padrão
    // para evitar "Cannot destructure property 'data' of undefined"
    this.queryBuilder.single.mockReturnValue(Promise.resolve({ data: null, error: null }))
  }

  /**
   * Configura os clientes Supabase
   */
  private setupClients() {
    const createClient = () => {
      // Criar mock de from() que sempre retorna o queryBuilder
      const fromMock = vi.fn()
      fromMock.mockReturnValue(this.queryBuilder)
      
      // Inicializar Map para RPC mocks ANTES de criar o cliente
      const rpcMocks = new Map()
      
      return {
        from: fromMock,
        rpc: vi.fn(), // Adicionar método rpc
        auth: {
          getUser: vi.fn(),
          getSession: vi.fn(),
        },
        __rpcMocks: rpcMocks, // Adicionar Map para RPC mocks
      }
    }

    this.supabaseClient = createClient()
    this.authClient = createClient()
    this.serviceRoleClient = createClient()
  }

  /**
   * Configura o mock do createClient
   * Estratégia de detecção:
   * 1. Se tem Authorization header -> authClient (cliente com token)
   * 2. Se key existe e não é anon key -> serviceRoleClient
   * 3. Caso contrário -> supabaseClient (cliente anon)
   */
  private setupCreateClientMock() {
    this.createClientCallIndex = 0
    
    ;(createClient as any).mockImplementation((url: string, key: string, options?: any) => {
      this.createClientCallIndex++
      
      // Prioridade 1: Se tem options.global.headers.Authorization, é cliente com token
      // Exemplo: createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer ...' } } })
      if (options?.global?.headers?.Authorization || options?.global?.headers?.authorization) {
        return this.authClient
      }
      
      // Prioridade 2: Se não tem Authorization header, verificar se a key é service role
      // Estratégia: Se não é claramente anon key, assume service role
      // (o código real só cria 2 tipos: com token OU com service role)
      if (key && typeof key === 'string' && key.length > 0) {
        // Verificar se é claramente uma anon key
        // Anon keys geralmente:
        // - Contêm "anon" no nome
        // - Começam com "sb_publishable_" (formato atual do Supabase)
        // - Começam com "eyJ" (JWT) e são relativamente curtas (<80 chars)
        const isAnonKey = 
          key.includes('anon') || 
          key.startsWith('sb_publishable_') ||
          key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          // JWT keys que começam com eyJ e são curtas são geralmente anon
          (key.startsWith('eyJ') && key.length < 80 && !key.includes('secret'))
        
        // Se é claramente anon key E não tem Authorization, retorna cliente anon
        // (caso raro onde o código cria cliente anon direto)
        if (isAnonKey) {
          return this.supabaseClient
        }
        
        // Se não é claramente anon key, provavelmente é service role
        // Service role keys geralmente:
        // - Começam com "sb_secret_" (formato atual: sb_secret_*)
        // - Contêm "service_role" ou "sb_secret_" no nome
        // - São relativamente longas (40-60 chars para sb_secret_*)
        // - Não começam com "eyJ" OU são muito longas
        const isServiceRoleKey = 
          key.startsWith('sb_secret_') ||      // Formato atual do Supabase
          key.includes('sb_secret_') ||        // Contém o prefixo
          key.includes('service_role') ||       // Formato legado
          // Verificar se corresponde ao env var (se disponível)
          (process.env.SUPABASE_SERVICE_ROLE_KEY && key === process.env.SUPABASE_SERVICE_ROLE_KEY) ||
          // Se é longa (>40 chars) e não é claramente anon, provavelmente é service role
          (key.length > 40 && !key.startsWith('eyJ') && !key.includes('anon') && !key.startsWith('sb_publishable_')) ||
          // Se tem tamanho razoável (>30 chars) e não começa com "eyJ" nem contém "anon" nem "publishable"
          (key.length > 30 && !key.startsWith('eyJ') && !key.includes('anon') && !key.startsWith('sb_publishable_'))
        
        if (isServiceRoleKey) {
          return this.serviceRoleClient
        }
        
        // Estratégia de fallback agressiva:
        // Se chegou aqui, a key existe mas não passou nos checks acima
        // Se não tem Authorization header E key não é claramente anon,
        // assumimos service role (é muito mais comum no código real)
        if (!key.includes('anon') && !key.startsWith('eyJ') && !key.startsWith('sb_publishable_')) {
          return this.serviceRoleClient
        }
      }
      
      // Prioridade 3: Se não tem key ou key é vazia/inválida, retorna cliente anon
      // (caso raro, mas possível)
      return this.supabaseClient
    })
  }

  /**
   * Retorna o query builder para configuração direta
   */
  getQueryBuilder() {
    return this.queryBuilder
  }

  /**
   * Retorna o cliente Supabase padrão
   */
  getClient() {
    return this.supabaseClient
  }

  /**
   * Retorna o cliente com token (autenticado)
   */
  getAuthClient() {
    return this.authClient
  }

  /**
   * Retorna o cliente com service role
   */
  getServiceRoleClient() {
    return this.serviceRoleClient
  }

  /**
   * Configura auth.getUser para retornar um usuário mockado
   */
  mockAuthUser(user: { id: string; email?: string } | null, error: any = null) {
    // Mock para cliente com token (chamada com token como argumento)
    // IMPORTANTE: Sempre retornar o formato { data: { user }, error } mesmo quando user é null
    // IMPORTANTE: Algumas APIs (como Lessons) usam serviceRoleClient.auth.getUser(token)
    // então precisamos mockar ambos authClient E serviceRoleClient
    const mockGetUser = (token?: string) => {
      if (user) {
        return Promise.resolve({ data: { user }, error: null })
      }
      // Quando não autenticado, retornar erro mas com data definida
      // O código faz: const { data: { user: tokenUser } } = await supabase.auth.getUser(token)
      // Então precisa sempre ter a estrutura { data: { user }, error }
      return Promise.resolve({ 
        data: { user: null }, 
        error: error || { message: 'Invalid token', status: 401 } 
      })
    }
    
    this.authClient.auth.getUser = vi.fn().mockImplementation(mockGetUser)
    // IMPORTANTE: Lessons API usa serviceRoleClient.auth.getUser(token)
    this.serviceRoleClient.auth.getUser = vi.fn().mockImplementation(mockGetUser)
    
    // Mock para cliente anon (chamada sem argumentos) - usado pelo supabaseServer
    this.supabaseClient.auth.getUser = vi.fn().mockImplementation(() => {
      if (user) {
        return Promise.resolve({ data: { user }, error: null })
      }
      // Quando não autenticado, retornar erro mas com data definida
      // O código faz: const { data: { user: cookieUser } } = await sb.auth.getUser()
      return Promise.resolve({ 
        data: { user: null }, 
        error: error || { message: 'Not authenticated', status: 401 } 
      })
    })
    
    return this
  }

  /**
   * Configura um mock para uma query Supabase encadeada
   * Exemplo: .mockQuery('from', 'profiles', 'select', 'role', 'eq', 'id', 'single', { data: {...}, error: null })
   */
  mockQuery(...args: any[]): this {
    // O último argumento deve ser o resultado { data, error }
    const result = args.pop()
    
    // Configura cada método na sequência
    let currentBuilder = this.queryBuilder
    
    for (let i = 0; i < args.length; i++) {
      const method = args[i]
      const value = args[i + 1]
      
      if (method === 'from') {
        // from() retorna o query builder
        this.serviceRoleClient.from.mockReturnValueOnce(currentBuilder)
        this.authClient.from.mockReturnValueOnce(currentBuilder)
        this.supabaseClient.from.mockReturnValueOnce(currentBuilder)
        i++ // Pula o próximo (tabela)
      } else if (method === 'single' || method === 'maybeSingle') {
        // Último método - retorna o resultado
        currentBuilder[method].mockResolvedValueOnce(result)
      } else if (value !== undefined) {
        // Método com valor (eq, in, etc.)
        currentBuilder[method].mockReturnValueOnce(currentBuilder)
        i++ // Pula o próximo (valor)
      } else {
        // Método sem valor (select, insert, etc.)
        currentBuilder[method].mockReturnValueOnce(currentBuilder)
      }
    }
    
    return this
  }

  /**
   * Helper para mockar uma query simples
   * Exemplo: .mockSimpleQuery('profiles', 'single', { data: { role: 'admin' }, error: null })
   * Por padrão usa service role client, mas pode especificar qual cliente usar
   */
  mockSimpleQuery(
    table: string, 
    finalMethod: 'single' | 'maybeSingle', 
    result: { data: any; error: any | null },
    useClient: 'serviceRole' | 'auth' | 'all' = 'serviceRole'
  ): this {
    // Configurar from() para retornar o builder
    // IMPORTANTE: mockReturnValueOnce é usado para cada chamada na ordem
    // mockReturnValue é usado como fallback se houver mais chamadas
    if (useClient === 'all' || useClient === 'serviceRole') {
      // Garantir que from() sempre retorna o builder como padrão
      this.serviceRoleClient.from.mockReturnValue(this.queryBuilder)
      // Adicionar chamada específica (usada na ordem)
      this.serviceRoleClient.from.mockReturnValueOnce(this.queryBuilder)
    }
    if (useClient === 'all' || useClient === 'auth') {
      this.authClient.from.mockReturnValue(this.queryBuilder)
      this.authClient.from.mockReturnValueOnce(this.queryBuilder)
    }
    if (useClient === 'all') {
      this.supabaseClient.from.mockReturnValue(this.queryBuilder)
      this.supabaseClient.from.mockReturnValueOnce(this.queryBuilder)
    }
    
    // IMPORTANTE: Cada método encadeado também precisa retornar o builder
    // select(), eq(), etc. já retornam o builder por padrão, mas precisamos garantir
    // que single()/maybeSingle() retornem o resultado na ordem correta
    // Usar mockResolvedValueOnce para garantir ordem e permitir múltiplas chamadas
    this.queryBuilder[finalMethod].mockResolvedValueOnce(result)
    // Também configurar como padrão caso seja chamado novamente
    this.queryBuilder[finalMethod].mockResolvedValue(result)
    return this
  }

  /**
   * Helper para mockar múltiplas queries em sequência
   */
  mockQueries(queries: Array<{ table: string; method: 'single' | 'maybeSingle'; result: { data: any; error: any | null } }>): this {
    queries.forEach(query => {
      this.mockSimpleQuery(query.table, query.method, query.result)
    })
    return this
  }

  /**
   * Helper para mockar uma inserção
   */
  mockInsert(table: string, result: { data: any; error: any | null }): this {
    // Inserção geralmente usa service role client
    // O código faz: serviceRoleSupabase.from('table').insert(...).select().single()
    // IMPORTANTE: Precisamos garantir que from() retorne o builder
    // Como pode haver múltiplas chamadas de from() antes (ex: profiles, courses),
    // usamos mockReturnValueOnce para adicionar uma nova chamada específica
    this.serviceRoleClient.from.mockReturnValue(this.queryBuilder)
    this.serviceRoleClient.from.mockReturnValueOnce(this.queryBuilder)
    
    // Configurar insert(), select() e single() para retornar na ordem correta
    // IMPORTANTE: Como há múltiplas chamadas de single() (profiles, lessons),
    // precisamos garantir que esta seja a segunda chamada
    this.queryBuilder.insert.mockReturnValue(this.queryBuilder)
    this.queryBuilder.insert.mockReturnValueOnce(this.queryBuilder)
    this.queryBuilder.select.mockReturnValue(this.queryBuilder)
    this.queryBuilder.select.mockReturnValueOnce(this.queryBuilder)
    // single() retorna Promise com { data, error }
    // Usar mockResolvedValueOnce para garantir que retorne o resultado na ordem correta
    this.queryBuilder.single.mockResolvedValueOnce(result)
    return this
  }

  /**
   * Helper para mockar uma atualização
   */
  mockUpdate(table: string, result: { data: any; error: any | null }): this {
    // Atualização geralmente usa service role client
    // O código faz: serviceRoleSupabase.from('courses').update(...).eq('id', ...).select().single()
    // IMPORTANTE: Precisamos garantir que single() retorna o resultado na ordem correta
    // Garantir que from() sempre retorne o builder como padrão
    this.serviceRoleClient.from.mockReturnValue(this.queryBuilder)
    this.serviceRoleClient.from.mockReturnValueOnce(this.queryBuilder)
    // Cada método encadeado retorna o builder
    this.queryBuilder.update.mockReturnValueOnce(this.queryBuilder)
    this.queryBuilder.eq.mockReturnValueOnce(this.queryBuilder)
    this.queryBuilder.select.mockReturnValueOnce(this.queryBuilder)
    // IMPORTANTE: single() é o último método e retorna Promise<{ data, error }>
    // Usamos mockResolvedValueOnce para garantir que retorna o resultado correto
    // mas apenas para esta chamada específica
    this.queryBuilder.single.mockResolvedValueOnce(result)
    return this
  }

  /**
   * Helper para mockar uma deleção
   */
  mockDelete(table: string, result: { error: any | null }): this {
    // Deleção geralmente usa service role client
    // O código faz: const { error: deleteError } = await serviceRoleSupabase.from('courses').delete().eq('id', id)
    // Supabase retorna { data, error } mesmo para delete
    // IMPORTANTE: eq() é o último método na cadeia, então precisa retornar o resultado completo
    // NOTA: Como há múltiplas chamadas de eq() (uma para o perfil, uma para o delete),
    // precisamos garantir que o eq() retorne o resultado APENAS quando for chamado APÓS delete()
    
    // Rastrear quantas chamadas de delete() foram feitas
    let deleteCallCount = 0
    let eqCallCount = 0
    
    // Configurar from() para retornar o queryBuilder
    this.serviceRoleClient.from.mockReturnValue(this.queryBuilder)
    this.serviceRoleClient.from.mockReturnValueOnce(this.queryBuilder)
    
    // Configurar delete() para incrementar contador e retornar o queryBuilder
    this.queryBuilder.delete.mockImplementationOnce(() => {
      deleteCallCount++
      return this.queryBuilder
    })
    
    // IMPORTANTE: eq() precisa retornar uma Promise com { data, error } quando é chamado APÓS delete()
    // Como há múltiplas chamadas de eq(), vamos usar um contador para identificar a última
    // A última chamada de eq() será a que ocorre APÓS delete()
    this.queryBuilder.eq.mockImplementationOnce((column: string, value: any) => {
      eqCallCount++
      // Se delete() foi chamado antes (deleteCallCount > 0), esta é a chamada do delete
      // Retornar Promise com resultado
      if (deleteCallCount > 0 && eqCallCount === deleteCallCount) {
        return Promise.resolve({
          data: result.error ? null : [], // Supabase retorna array vazio em caso de sucesso
          error: result.error || null,
        })
      }
      // Caso contrário, retornar queryBuilder para permitir encadeamento
      return this.queryBuilder
    })
    
    // Garantir que eq() retorna queryBuilder por padrão (para outras chamadas)
    this.queryBuilder.eq.mockReturnValue(this.queryBuilder)
    
    return this
  }

  /**
   * Helper para mockar uma query de listagem (com count)
   * Suporta encadeamento: .select().eq().order().range() ou apenas .select().eq().order()
   */
  mockList(table: string, result: { data: any[]; error: any | null; count?: number }): this {
    // Listagem pode usar qualquer cliente, então mockamos todos
    // Garantir que from() sempre retorna o builder como padrão
    this.serviceRoleClient.from.mockReturnValue(this.queryBuilder)
    this.authClient.from.mockReturnValue(this.queryBuilder)
    this.supabaseClient.from.mockReturnValue(this.queryBuilder)
    
    // Adicionar chamadas específicas para esta query
    this.serviceRoleClient.from.mockReturnValueOnce(this.queryBuilder)
    this.authClient.from.mockReturnValueOnce(this.queryBuilder)
    this.supabaseClient.from.mockReturnValueOnce(this.queryBuilder)
    
    // IMPORTANTE: No Supabase, quando você faz:
    // await supabase.from('table').select().eq().order().limit().gte()
    // O último método encadeado precisa retornar uma Promise
    
    // Criar um objeto "thenable" que funciona como builder E como Promise
    const createThenable = (finalResult: any) => {
      const thenable: any = Object.assign({}, this.queryBuilder)
      thenable.then = (onResolve: any, onReject?: any) => {
        const promise = Promise.resolve(finalResult)
        return promise.then(onResolve, onReject)
      }
      thenable.catch = (onReject: any) => Promise.resolve(finalResult).catch(onReject)
      thenable.finally = (onFinally: any) => Promise.resolve(finalResult).finally(onFinally)
      return thenable
    }
    
    const finalResult = {
      data: result.data || [],
      error: result.error,
      count: result.count || 0,
    }
    
    // Mockar limit() - se chamado, retorna thenable (Promise-like)
    this.queryBuilder.limit.mockImplementationOnce((count: number) => {
      return createThenable(finalResult)
    })
    
    // Mockar gte() - se chamado, retorna thenable (Promise-like)
    this.queryBuilder.gte.mockImplementationOnce((column: string, value: any) => {
      return createThenable(finalResult)
    })
    
    // Mockar range() - se chamado, retorna thenable (Promise-like)
    this.queryBuilder.range.mockImplementationOnce((from: number, to: number) => {
      return createThenable(finalResult)
    })
    
    // Mockar order() - retorna thenable que funciona como builder E como Promise
    // IMPORTANTE: Usar mockImplementation (não Once) para permitir múltiplas chamadas
    // Cada chamada de mockList cria um novo contexto, então podemos sobrescrever
    // Usar uma função que captura o finalResult do escopo atual
    const orderImplementation = (column: string, options?: any) => {
      return createThenable(finalResult)
    }
    this.queryBuilder.order.mockImplementation(orderImplementation)
    
    // IMPORTANTE: Se nenhum método final (limit, range, gte, order) for chamado,
    // o próprio select() ou eq() pode retornar a Promise diretamente
    // Garantir que select() também retorna thenable quando não há método final após eq()
    this.queryBuilder.select.mockImplementationOnce((columns?: string) => {
      // Se já foi configurado limit/range/gte/order, não fazer nada (já retornará thenable)
      // Mas se não, retornar thenable como fallback
      return this.queryBuilder
    })
    
    // Se eq() for o último método chamado (sem limit/range/gte/order depois),
    // retornar thenable diretamente
    this.queryBuilder.eq.mockImplementationOnce((column: string, value: any) => {
      // Verificar se há mais métodos na cadeia - se não houver, retornar thenable
      // Por enquanto, retornar builder para permitir mais encadeamento
      return this.queryBuilder
    })
    
    // Como fallback final, garantir que o resultado seja acessível
    // Se a query não terminar com limit/range/gte/order, o último eq() deve retornar thenable
    // Vamos fazer isso verificando se há mais métodos na cadeia
    
    return this
  }

  /**
   * Reseta todos os mocks
   */
  reset() {
    vi.clearAllMocks()
    this.callHistory = []
    this.createClientCallIndex = 0
    this.setupQueryBuilder()
    this.setupClients()
    this.setupCreateClientMock()
  }

  /**
   * Configura mocks padrão para beforeEach
   */
  setup() {
    this.reset()
    return this
  }

  /**
   * Helper para criar um perfil mockado
   */
  static createMockProfile(role: 'admin' | 'instructor' | 'student' | 'user' | 'guest' = 'student') {
    return { role }
  }

  /**
   * Helper para criar um usuário mockado
   */
  static createMockUser(id: string = 'user-1', email: string = 'user@test.com') {
    return { id, email }
  }

  /**
   * Alias para mockAuthUser (para compatibilidade com testes existentes)
   */
  mockAuth(options: { user: { id: string; email?: string } | null }) {
    return this.mockAuthUser(options.user || null)
  }

  /**
   * Mock de perfil (para compatibilidade com testes de gamificação)
   */
  mockProfile(profile: { id: string; role: string }) {
    // Mock profile query
    this.mockSimpleQuery('profiles', 'single', {
      data: profile,
      error: null,
    }, 'serviceRole')
    return this
  }

  /**
   * Mock de RPC (Remote Procedure Call) do Supabase
   */
  mockRpc(functionName: string, result: { data: any; error: any | null }) {
    // Adicionar método rpc ao query builder se não existir
    if (!this.queryBuilder.rpc) {
      this.queryBuilder.rpc = vi.fn()
    }
    
    // Armazenar o resultado mockado para esta função
    // IMPORTANTE: Usar Map para suportar múltiplos mocks de RPC
    // Maps devem estar inicializados em setupClients, mas garantimos existência aqui também
    const serviceRoleMocks = (this.serviceRoleClient as any).__rpcMocks || new Map()
    const authMocks = (this.authClient as any).__rpcMocks || new Map()
    const supabaseMocks = (this.supabaseClient as any).__rpcMocks || new Map()
    
    // Atualizar referências nos clientes se não existirem
    if (!(this.serviceRoleClient as any).__rpcMocks) {
      (this.serviceRoleClient as any).__rpcMocks = serviceRoleMocks
    }
    if (!(this.authClient as any).__rpcMocks) {
      (this.authClient as any).__rpcMocks = authMocks
    }
    if (!(this.supabaseClient as any).__rpcMocks) {
      (this.supabaseClient as any).__rpcMocks = supabaseMocks
    }
    
    // Adicionar mock para esta função específica
    serviceRoleMocks.set(functionName, result)
    authMocks.set(functionName, result)
    supabaseMocks.set(functionName, result)

    // Adicionar rpc aos clientes se não existir (devem estar em setupClients, mas garantimos)
    if (!this.serviceRoleClient.rpc) {
      this.serviceRoleClient.rpc = vi.fn()
    }
    if (!this.authClient.rpc) {
      this.authClient.rpc = vi.fn()
    }
    if (!this.supabaseClient.rpc) {
      this.supabaseClient.rpc = vi.fn()
    }
    
    // Usar mockImplementation que verifica o nome da função
    // IMPORTANTE: Substituir implementação, não usar mockImplementationOnce
    // para permitir múltiplas chamadas da mesma função
    this.serviceRoleClient.rpc.mockImplementation((name: string, ...args: any[]) => {
      const mockResult = (this.serviceRoleClient as any).__rpcMocks?.get(name)
      if (mockResult) {
        return Promise.resolve(mockResult)
      }
      // Se não encontrou mock específico, retornar erro
      return Promise.resolve({ data: null, error: { message: `Function ${name} not mocked` } })
    })
    
    this.authClient.rpc.mockImplementation((name: string, ...args: any[]) => {
      const mockResult = (this.authClient as any).__rpcMocks?.get(name)
      if (mockResult) {
        return Promise.resolve(mockResult)
      }
      return Promise.resolve({ data: null, error: { message: `Function ${name} not mocked` } })
    })

    this.supabaseClient.rpc.mockImplementation((name: string, ...args: any[]) => {
      const mockResult = (this.supabaseClient as any).__rpcMocks?.get(name)
      if (mockResult) {
        return Promise.resolve(mockResult)
      }
      return Promise.resolve({ data: null, error: { message: `Function ${name} not mocked` } })
    })

    return this
  }

  /**
   * Permite chamar mockSupabase.from().insert() diretamente
   */
  get from() {
    return this.serviceRoleClient.from
  }

  /**
   * Permite chamar mockSupabase.rpc() diretamente
   */
  rpc(name: string, args?: any) {
    // Retornar o rpc do cliente padrão (supabaseClient)
    return this.supabaseClient.rpc(name, args)
  }
}

// Exportar instância singleton para uso global
export const mockSupabase = new MockSupabaseHelper()

// Exportar helpers estáticos
export const createMockProfile = MockSupabaseHelper.createMockProfile
export const createMockUser = MockSupabaseHelper.createMockUser

