-- WE Academy - Dados de seed com usuários RBAC
-- Criado em: 2024-10-20

-- Inserir categorias de cursos
INSERT INTO public.categories (name, slug, description, icon, color) VALUES
('Desenvolvimento Web', 'desenvolvimento-web', 'Aprenda a criar sites e aplicações web modernas', 'code', '#3B82F6'),
('Design', 'design', 'Cursos de design gráfico, UI/UX e ferramentas criativas', 'palette', '#8B5CF6'),
('Marketing Digital', 'marketing-digital', 'Estratégias de marketing online e redes sociais', 'megaphone', '#10B981'),
('Negócios', 'negocios', 'Empreendedorismo e gestão de negócios', 'briefcase', '#F59E0B'),
('Tecnologia', 'tecnologia', 'Cursos sobre tecnologias emergentes e programação', 'cpu', '#EF4444');

-- Inserir usuários de demonstração (estes serão criados automaticamente quando os usuários se registrarem)
-- Aqui apenas definimos alguns perfis de exemplo para demonstração

-- Inserir cursos de exemplo
INSERT INTO public.courses (title, slug, description, short_description, price, is_free, is_published, level, duration_hours, category_id) VALUES
(
    'React do Zero ao Avançado',
    'react-do-zero-ao-avancado',
    'Aprenda React desde o básico até conceitos avançados como hooks, context, redux e muito mais. Este curso completo te prepara para criar aplicações React profissionais.',
    'Domine React e crie aplicações modernas e escaláveis',
    199.90,
    false,
    true,
    'intermediate',
    40,
    (SELECT id FROM public.categories WHERE slug = 'desenvolvimento-web')
),
(
    'JavaScript Fundamentos',
    'javascript-fundamentos',
    'Aprenda os fundamentos do JavaScript, a linguagem mais popular do mundo web. Desde variáveis até funções avançadas e manipulação do DOM.',
    'Aprenda JavaScript do zero com projetos práticos',
    0,
    true,
    true,
    'beginner',
    20,
    (SELECT id FROM public.categories WHERE slug = 'desenvolvimento-web')
),
(
    'UI/UX Design com Figma',
    'ui-ux-design-com-figma',
    'Crie interfaces incríveis usando Figma. Aprenda princípios de design, criação de protótipos e colaboração em equipe.',
    'Domine o Figma e crie designs profissionais',
    149.90,
    false,
    true,
    'beginner',
    25,
    (SELECT id FROM public.categories WHERE slug = 'design')
),
(
    'Marketing Digital Completo',
    'marketing-digital-completo',
    'Estratégias completas de marketing digital: SEO, SEM, redes sociais, email marketing e análise de dados.',
    'Domine todas as ferramentas do marketing digital',
    299.90,
    false,
    true,
    'intermediate',
    35,
    (SELECT id FROM public.categories WHERE slug = 'marketing-digital')
),
(
    'Python para Data Science',
    'python-para-data-science',
    'Aprenda Python aplicado à ciência de dados. Pandas, NumPy, Matplotlib e machine learning básico.',
    'Python para análise de dados e machine learning',
    249.90,
    false,
    true,
    'intermediate',
    30,
    (SELECT id FROM public.categories WHERE slug = 'tecnologia')
);

-- Inserir módulos para o curso de React
INSERT INTO public.modules (course_id, title, description, order_index) VALUES
(
    (SELECT id FROM public.courses WHERE slug = 'react-do-zero-ao-avancado'),
    'Introdução ao React',
    'Conceitos básicos e configuração do ambiente',
    1
),
(
    (SELECT id FROM public.courses WHERE slug = 'react-do-zero-ao-avancado'),
    'Componentes e Props',
    'Criando e reutilizando componentes',
    2
),
(
    (SELECT id FROM public.courses WHERE slug = 'react-do-zero-ao-avancado'),
    'Estado e Ciclo de Vida',
    'Gerenciando estado com useState e useEffect',
    3
),
(
    (SELECT id FROM public.courses WHERE slug = 'react-do-zero-ao-avancado'),
    'Hooks Avançados',
    'useContext, useReducer e hooks customizados',
    4
),
(
    (SELECT id FROM public.courses WHERE slug = 'react-do-zero-ao-avancado'),
    'Roteamento e Navegação',
    'React Router e navegação entre páginas',
    5
);

-- Inserir aulas para o primeiro módulo do curso de React
INSERT INTO public.lessons (module_id, title, description, duration_minutes, order_index, is_preview) VALUES
(
    (SELECT id FROM public.modules WHERE title = 'Introdução ao React' AND order_index = 1),
    'O que é React?',
    'Entenda o que é React e por que usá-lo',
    15,
    1,
    true
),
(
    (SELECT id FROM public.modules WHERE title = 'Introdução ao React' AND order_index = 1),
    'Configurando o ambiente',
    'Instalando Node.js, npm e criando o primeiro projeto',
    20,
    2,
    true
),
(
    (SELECT id FROM public.modules WHERE title = 'Introdução ao React' AND order_index = 1),
    'JSX e Componentes básicos',
    'Aprendendo JSX e criando componentes simples',
    25,
    3,
    false
),
(
    (SELECT id FROM public.modules WHERE title = 'Introdução ao React' AND order_index = 1),
    'Primeiro projeto prático',
    'Criando uma aplicação React simples',
    30,
    4,
    false
);

-- Inserir módulos para o curso de JavaScript
INSERT INTO public.modules (course_id, title, description, order_index) VALUES
(
    (SELECT id FROM public.courses WHERE slug = 'javascript-fundamentos'),
    'Variáveis e Tipos de Dados',
    'Aprendendo sobre variáveis e tipos em JavaScript',
    1
),
(
    (SELECT id FROM public.courses WHERE slug = 'javascript-fundamentos'),
    'Funções',
    'Criando e usando funções em JavaScript',
    2
),
(
    (SELECT id FROM public.courses WHERE slug = 'javascript-fundamentos'),
    'Arrays e Objetos',
    'Trabalhando com estruturas de dados',
    3
),
(
    (SELECT id FROM public.courses WHERE slug = 'javascript-fundamentos'),
    'DOM e Eventos',
    'Manipulando elementos HTML e eventos',
    4
);

-- Inserir aulas para o primeiro módulo do curso de JavaScript
INSERT INTO public.lessons (module_id, title, description, duration_minutes, order_index, is_preview) VALUES
(
    (SELECT id FROM public.modules WHERE title = 'Variáveis e Tipos de Dados' AND order_index = 1),
    'Introdução ao JavaScript',
    'O que é JavaScript e onde é usado',
    10,
    1,
    true
),
(
    (SELECT id FROM public.modules WHERE title = 'Variáveis e Tipos de Dados' AND order_index = 1),
    'Declarando variáveis',
    'var, let e const - diferenças e uso',
    15,
    2,
    true
),
(
    (SELECT id FROM public.modules WHERE title = 'Variáveis e Tipos de Dados' AND order_index = 1),
    'Tipos de dados',
    'String, Number, Boolean, Array, Object',
    20,
    3,
    false
),
(
    (SELECT id FROM public.modules WHERE title = 'Variáveis e Tipos de Dados' AND order_index = 1),
    'Exercícios práticos',
    'Praticando com variáveis e tipos',
    15,
    4,
    false
);