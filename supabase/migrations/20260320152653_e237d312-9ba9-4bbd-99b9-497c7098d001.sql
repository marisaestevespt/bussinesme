
-- Create enum for launch task phases
CREATE TYPE public.launch_phase AS ENUM (
  'estrategia', 'antecipacao', 'captacao', 'produto_servico', 'venda', 'debriefing_pos_fecho'
);

-- Create enum for launch task status
CREATE TYPE public.launch_task_status AS ENUM (
  'por_comecar', 'em_curso', 'concluido', 'bloqueado'
);

-- Create launch_tasks table
CREATE TABLE public.launch_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  phase launch_phase NOT NULL DEFAULT 'estrategia',
  status launch_task_status NOT NULL DEFAULT 'por_comecar',
  responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  sector_area TEXT,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL
);

-- Create launch_data table
CREATE TABLE public.launch_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  objetivo_geral TEXT,
  sobre_lancamento TEXT,
  brainstorming TEXT,
  analise_publico_descricao TEXT,
  analise_publico_dores JSONB DEFAULT '[]'::jsonb,
  mapa_objeccoes JSONB DEFAULT '[]'::jsonb,
  produto_oferta TEXT,
  produto_por_dentro TEXT,
  produto_cliente_ideal TEXT,
  produto_faqs TEXT,
  produto_feedbacks TEXT,
  cronograma JSONB DEFAULT '[]'::jsonb,
  links_uteis JSONB DEFAULT '[]'::jsonb,
  materiais_antecipacao JSONB,
  materiais_venda JSONB,
  tracking_resultados_globais JSONB,
  tracking_trafego JSONB DEFAULT '[]'::jsonb,
  tracking_performance_diaria JSONB DEFAULT '[]'::jsonb,
  estrategia_objetivo TEXT,
  estrategia_macro_fases JSONB DEFAULT '[]'::jsonb,
  estrategia_pilares JSONB DEFAULT '[]'::jsonb,
  estrategia_indicadores JSONB DEFAULT '[]'::jsonb,
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE public.launch_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launch_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for launch_tasks (same as projects - authenticated users can access)
CREATE POLICY "Authenticated users can view launch tasks"
  ON public.launch_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert launch tasks"
  ON public.launch_tasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update launch tasks"
  ON public.launch_tasks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete launch tasks"
  ON public.launch_tasks FOR DELETE TO authenticated USING (true);

-- RLS policies for launch_data
CREATE POLICY "Authenticated users can view launch data"
  ON public.launch_data FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert launch data"
  ON public.launch_data FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update launch data"
  ON public.launch_data FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete launch data"
  ON public.launch_data FOR DELETE TO authenticated USING (true);

-- Index for performance
CREATE INDEX idx_launch_tasks_project ON public.launch_tasks(project_id);
CREATE INDEX idx_launch_data_project ON public.launch_data(project_id);
