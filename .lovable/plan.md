
# Pacote Segurança P0 — Proposta técnica para revisão

**Nada será aplicado até aprovares.** Esta proposta cobre A→F do âmbito.

---

## 0. Estado atual relevante

- **Enum `app_role` atual**: `owner`, `admin`, `member` → tem de ser estendido para 8 roles.
- **`team_members`** já tem: `departments jsonb`, `iban`, `fiscal_address`, `payment_method`, `custom_role_id`, `access_revoked`. **Não tem** `is_external` nem `access_suspended`.
- **`project_members`** existe (`project_id`, `profile_id`, `role`) — base para ACL "team_member vê só projetos atribuídos".
- **Não existe** tabela equivalente para "sales atribuído a cliente/lead". Vou usar:
  - `crm_leads.responsible_id` (já existe)
  - `commercial_sales.created_by` + nova coluna `assigned_to uuid` (proposta)
  - `clients` → derivar via projetos atribuídos OU nova tabela `client_assignments` (proposta).
- **`portal-uploads`**: bucket público, 6 ficheiros, sem código frontend que escreva (o anterior componente foi removido) → vamos privar e canalizar via edge function.
- **Buckets públicos atuais**: `custom-fonts`, `logos`, `personal-images`, `portal-uploads`.

---

## A. Sistema de 8 roles

### A.1 Migração do enum

Postgres não suporta `DROP VALUE` de enum facilmente. Estratégia mais segura: **renomear enum antigo, criar novo, migrar coluna**.

```sql
-- 1. Renomear enum antigo (mantém rollback fácil)
ALTER TYPE public.app_role RENAME TO app_role_legacy;

-- 2. Criar enum novo com 8 roles
CREATE TYPE public.app_role AS ENUM (
  'owner',
  'admin',
  'accountant',
  'hr',
  'admin_staff',
  'sales',
  'team_member',
  'viewer'
);

-- 3. Adicionar coluna nova em user_roles, copiar com mapeamento
ALTER TABLE public.user_roles ADD COLUMN role_new public.app_role;

UPDATE public.user_roles SET role_new = CASE
  WHEN role::text = 'owner'  THEN 'owner'::public.app_role
  WHEN role::text = 'admin'  THEN 'admin'::public.app_role
  WHEN role::text = 'member' THEN 'team_member'::public.app_role
END;

-- 4. Trocar colunas
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles DROP COLUMN role;
ALTER TABLE public.user_roles RENAME COLUMN role_new TO role;
ALTER TABLE public.user_roles ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- 5. Reescrever has_role (assinatura mantém-se)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

DROP TYPE public.app_role_legacy;
```

### A.2 Helpers SECURITY DEFINER (chave para policies não-recursivas)

```sql
-- Conveniências
CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT public.has_role(auth.uid(), 'owner') $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_roles public.app_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role = ANY(_roles)) $$;

-- Devolve o team_members.id do utilizador autenticado (se existir)
CREATE OR REPLACE FUNCTION public.current_team_member_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT tm.id FROM public.team_members tm
  JOIN public.profiles p ON p.id = tm.profile_id
  WHERE p.user_id = auth.uid() LIMIT 1
$$;

-- Departamentos do user atual (jsonb→text[])
CREATE OR REPLACE FUNCTION public.current_user_departments() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(tm.departments)),
    CASE WHEN tm.department IS NOT NULL THEN ARRAY[tm.department] ELSE ARRAY[]::text[] END
  )
  FROM public.team_members tm
  JOIN public.profiles p ON p.id = tm.profile_id
  WHERE p.user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_in_department(_dept text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT _dept = ANY(public.current_user_departments()) $$;

-- Cliente atribuído? (via projects.client_id onde sou project_member, OU client_assignments)
CREATE OR REPLACE FUNCTION public.user_can_access_client(_client_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    public.is_admin_or_owner()
    OR EXISTS (
      SELECT 1 FROM public.projects pr
      JOIN public.project_members pm ON pm.project_id = pr.id
      JOIN public.profiles p ON p.id = pm.profile_id
      WHERE pr.client_id = _client_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.client_assignments ca
      JOIN public.profiles p ON p.id = ca.profile_id
      WHERE ca.client_id = _client_id AND p.user_id = auth.uid()
    )
$$;

-- Projeto atribuído?
CREATE OR REPLACE FUNCTION public.user_can_access_project(_project_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin_or_owner()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      JOIN public.profiles p ON p.id = pm.profile_id
      WHERE pm.project_id = _project_id AND p.user_id = auth.uid()
    )
$$;

-- Contabilista externa ativa? (ver C)
CREATE OR REPLACE FUNCTION public.accountant_access_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.profiles p ON p.id = tm.profile_id
    WHERE p.user_id = auth.uid()
      AND tm.access_suspended = true
  )
$$;
```

### A.3 Policies de gestão de roles (só owner)

```sql
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;

CREATE POLICY "user_roles_select_self_or_owner" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "user_roles_only_owner_writes" ON public.user_roles FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());
```

---

## B. Suporte por departamento

Já temos `team_members.departments jsonb` + `current_user_departments()`. Departamentos com privilégios automáticos:

| Departamento | Tabelas extra (SELECT) |
|---|---|
| `marketing` | `content_items`, `commercial_library_entries`, `marketing_*`, `traffic_*`, brand assets em `business_setup` (campos brand) |
| `comercial` | `crm_leads` (todos), `commercial_sales` (todos), `clients` (todos – sem fiscal/IBAN) |
| `financeiro` | (espelha `accountant`) `financial_*`, `suppliers`, `business_setup` read-only |
| `recursos-humanos` | (espelha `hr`) `team_members` completo, `member_contracts`, `financial_payroll` |
| `clientes` | `clients`, `client_contacts`, `tasks` cliente |
| `admin` | tudo (já existe via dept) |

Implementação: nas policies, `OR public.user_in_department('marketing')` etc. — combinado com role-based.

---

## C. Contabilista externa + audit

### C.1 Schema

```sql
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_suspended_by uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.role_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  actor_name text,
  action text NOT NULL CHECK (action IN (
    'role_granted','role_revoked','access_suspended','access_resumed',
    'sensitive_access_granted','sensitive_access_revoked',
    'client_assigned','client_unassigned'
  )),
  target_user_id uuid,
  target_member_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.role_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_log_owner_read" ON public.role_activity_log FOR SELECT USING (public.is_owner());
CREATE POLICY "role_log_system_write" ON public.role_activity_log FOR INSERT
  WITH CHECK (public.is_owner());

-- Triggers automáticos em user_roles e member_sensitive_access para escrever no log
CREATE OR REPLACE FUNCTION public.log_role_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _name text;
BEGIN
  SELECT full_name INTO _name FROM public.profiles WHERE user_id = auth.uid();
  IF TG_OP='INSERT' THEN
    INSERT INTO public.role_activity_log (actor_user_id, actor_name, action, target_user_id, metadata)
    VALUES (auth.uid(), _name, 'role_granted', NEW.user_id, jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    INSERT INTO public.role_activity_log (actor_user_id, actor_name, action, target_user_id, metadata)
    VALUES (auth.uid(), _name, 'role_revoked', OLD.user_id, jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_log_user_roles
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_role_change();
```

### C.2 Tabela `client_assignments` (para sales/admin_staff)

```sql
CREATE TABLE IF NOT EXISTS public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'general' CHECK (assignment_type IN ('general','sales','admin','support')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (client_id, profile_id, assignment_type)
);
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_read_self_or_admin" ON public.client_assignments FOR SELECT
  USING (public.is_admin_or_owner() OR profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));
CREATE POLICY "ca_write_owner_admin" ON public.client_assignments FOR ALL
  USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());

CREATE INDEX idx_ca_profile ON public.client_assignments(profile_id);
CREATE INDEX idx_ca_client ON public.client_assignments(client_id);
```

---

## D. Reescrita de SELECT em 13 tabelas

**Padrão geral**: cada policy DROP+CREATE, mantendo INSERT/UPDATE/DELETE como estão. Owner sempre passa via `is_owner()`. Contabilista externa requer `accountant_access_enabled()`.

### D.1 `clients` (PII, NIF, fiscal_address, IBAN indireto)

```sql
DROP POLICY IF EXISTS "Authenticated can read clients" ON public.clients;
DROP POLICY IF EXISTS "clients_select" ON public.clients;

CREATE POLICY "clients_select_role_based" ON public.clients FOR SELECT USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'admin_staff'))
  OR (public.has_role(auth.uid(),'sales') AND public.user_can_access_client(id))
  OR (public.has_role(auth.uid(),'team_member') AND public.user_can_access_client(id))
  OR public.user_in_department('comercial')
  OR public.user_in_department('clientes')
);
```
> **Nota**: campos sensíveis (`nif`, `fiscal_address`, `iban` se existir, `payment_method`, `birthday`, `whatsapp`) já têm vista `clients_public`. Para roles que não devem ver fiscal (sales/team_member), o frontend passa a usar `clients_public`. Plano: criar hook `useClients` que escolhe view conforme `has_role`.

### D.2 `client_contacts`

```sql
CREATE POLICY "cc_select" ON public.client_contacts FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'admin_staff')
  OR public.user_in_department('clientes')
  OR (public.has_role(auth.uid(),'sales')      AND public.user_can_access_client(client_id))
  OR (public.has_role(auth.uid(),'team_member') AND public.user_can_access_client(client_id))
);
```

### D.3 `team_members`

```sql
CREATE POLICY "tm_select" ON public.team_members FOR SELECT USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR public.user_in_department('recursos-humanos')
  OR public.is_self_team_member(id)              -- próprio sempre vê
  OR (
    -- restantes membros vêem campos básicos via VIEW team_members_public;
    -- aqui permitimos linha mas frontend mostra view sem IBAN/fiscal.
    auth.uid() IS NOT NULL
  )
);
-- Accountant: SELECT permitido só se accountant_access_enabled()
-- → adiciona-se via 2ª policy restritiva (RESTRICTIVE) sobre is_external:
CREATE POLICY "tm_external_suspended_block" ON public.team_members AS RESTRICTIVE FOR ALL
  USING (
    NOT (public.has_role(auth.uid(),'accountant')) OR public.accountant_access_enabled()
  );
```

> Para garantir IBAN/fiscal só visível a owner/admin/hr/accountant: **mover para vista**. Já existe `team_members_public`. Frontend lista via view; só páginas de RH/Contabilidade fazem `from('team_members')` direto e RLS bloqueia restantes.

### D.4 `business_setup` (NIF/NISS/IBAN da empresa)

```sql
CREATE POLICY "bs_select" ON public.business_setup FOR SELECT USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'accountant')
  OR public.has_role(auth.uid(),'hr')
  OR public.user_in_department('financeiro')
);
CREATE POLICY "bs_write_owner_admin" ON public.business_setup FOR ALL
  USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());
-- Accountant é READ-ONLY automaticamente (sem policy de UPDATE).
```

### D.5 `suppliers`, `financial_contractors`, `financial_documents`, `financial_expenses`, `financial_payroll`

```sql
-- Padrão financeiro
CREATE POLICY "fin_select" ON public.{TABELA} FOR SELECT USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.user_in_department('financeiro')
  OR public.current_user_has_sensitive_access('financial_values')
);
-- payroll também aceita hr / dept rh
CREATE POLICY "payroll_select" ON public.financial_payroll FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.user_in_department('recursos-humanos')
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid())  -- próprio vê o seu salário
);
```

### D.6 `crm_leads`

```sql
CREATE POLICY "leads_select" ON public.crm_leads FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'sales')
  OR public.user_in_department('comercial')
  OR responsible_id = public.current_team_member_id()
  OR created_by = auth.uid()
);
```

### D.7 `commercial_sales`

```sql
-- Adicionar coluna assigned_to
ALTER TABLE public.commercial_sales ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

CREATE POLICY "sales_select" ON public.commercial_sales FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.user_in_department('financeiro')
  OR public.user_in_department('comercial')
  OR (public.has_role(auth.uid(),'sales')
        AND (assigned_to = auth.uid() OR created_by = auth.uid()
             OR EXISTS(SELECT 1 FROM public.clients c WHERE c.full_name=commercial_sales.client AND public.user_can_access_client(c.id))))
  OR (public.has_role(auth.uid(),'admin_staff'))   -- vê faturas, mas frontend esconde custos
);
```
> `admin_staff` vê faturas mas não custos: `financial_expenses` continua bloqueado para admin_staff. UI mostra só `commercial_sales` (entradas).

### D.8 `business_legal_documents`

```sql
CREATE POLICY "bld_select" ON public.business_legal_documents FOR SELECT USING (
  public.is_owner()  -- ÚNICO. nem admin.
);
CREATE POLICY "bld_write" ON public.business_legal_documents FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());
```

### D.9 `member_contracts`

```sql
CREATE POLICY "mc_select" ON public.member_contracts FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR public.user_in_department('recursos-humanos')
  OR public.is_self_team_member(member_id)
);
```

### D.10 Resumo do mapeamento aplicado

| Tabela | owner | admin | accountant | hr | admin_staff | sales | team_member | viewer |
|---|---|---|---|---|---|---|---|---|
| clients | ✓ | ✓ | – | – | ✓ | atribuídos | atribuídos | agregados* |
| client_contacts | ✓ | ✓ | – | – | ✓ | atribuídos | atribuídos | – |
| team_members | ✓ full | ✓ full | só IBAN/fiscal | ✓ full | – | básico (view) | básico (view) | – |
| business_setup | ✓ | ✓ | read-only NIF/NISS | ✓ | – | – | – | – |
| suppliers | ✓ | ✓ | ✓ (se ativo) | – | – | – | – | – |
| crm_leads | ✓ | ✓ | – | – | – | ✓ | próprios | – |
| financial_contractors | ✓ | ✓ | ✓ (se ativo) | ✓ | – | – | – | – |
| financial_documents | ✓ | ✓ | ✓ (se ativo) | – | – | – | – | – |
| financial_expenses | ✓ | ✓ | ✓ (se ativo) | – | – | – | – | – |
| commercial_sales | ✓ | ✓ | ✓ (se ativo) | – | ✓ (sem custos UI) | atribuídos | – | – |
| business_legal_documents | ✓ | – | – | – | – | – | – | – |
| member_contracts | ✓ | ✓ | – | ✓ | – | – | próprio | – |
| financial_payroll | ✓ | ✓ | ✓ (se ativo) | ✓ | – | – | próprio | – |

*viewer: criar views agregadas dedicadas (fora deste pacote, fica como TODO).

---

## E. Bucket `portal-uploads` — lockdown (Opção B)

### E.1 SQL

```sql
UPDATE storage.buckets SET public = false WHERE id = 'portal-uploads';

DROP POLICY IF EXISTS "portal-uploads: authenticated can upload" ON storage.objects;
DROP POLICY IF EXISTS "portal-uploads: authenticated can read"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload portal files" ON storage.objects;

-- SELECT: só edge function (service role) ou utilizadores autenticados internos
CREATE POLICY "portal_uploads_internal_read" ON storage.objects FOR SELECT
  USING (bucket_id='portal-uploads' AND auth.uid() IS NOT NULL);

-- INSERT: NENHUM via SDK do cliente. Tudo passa por edge function `portal-upload` com service role.
-- (sem policy de INSERT para anon/authenticated)
```

### E.2 Edge function `portal-upload` (nova)

`supabase/functions/portal-upload/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '@supabase/supabase-js/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const form = await req.formData();
    const token = String(form.get('portal_token') ?? '');
    const questionId = String(form.get('question_id') ?? '');
    const file = form.get('file') as File | null;
    if (!token || !file) return json({ error: 'missing fields' }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ error: 'file too large' }, 413);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Validar token via RPC já existente
    const { data: ok } = await admin.rpc('portal_token_active', { _token: token });
    if (!ok) return json({ error: 'invalid token' }, 401);

    const safeName = file.name.replace(/[^\w.\-]/g,'_');
    const path = `${token}/${questionId}/${Date.now()}-${safeName}`;
    const { error } = await admin.storage.from('portal-uploads')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return json({ error: error.message }, 500);

    const { data: signed } = await admin.storage.from('portal-uploads')
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 dias

    return json({ path, url: signed?.signedUrl });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

const json = (b: unknown, s=200) => new Response(JSON.stringify(b),
  { status: s, headers: { ...corsHeaders, 'Content-Type':'application/json' } });
```

`supabase/config.toml`:
```toml
[functions.portal-upload]
  verify_jwt = false
```

**Frontend** (sem ficheiro existente que escreva → impacto zero). Quando se reativar upload no portal, chamar:
```ts
const fd = new FormData();
fd.append('portal_token', token);
fd.append('question_id', qId);
fd.append('file', file);
await supabase.functions.invoke('portal-upload', { body: fd });
```

Para ler ficheiros já existentes nas RPC `get_portal_*`, gerar signed URL on-the-fly:
- Adicionar RPC `get_portal_signed_url(_token uuid, _path text)` que valida token + chama `storage.create_signed_url` (via edge function, pois SQL não cria signed URLs).
- **Alternativa imediata**: edge function `portal-signed-url` que recebe token + path e devolve URL.

### E.3 Migração dos 6 ficheiros já existentes

Continuam acessíveis via signed URL gerada pelo edge. Nenhum precisa ser movido.

---

## F. Buckets `personal-images`, `logos`, `custom-fonts`

| Bucket | Conteúdo | Recomendação | Motivo |
|---|---|---|---|
| `logos` | Logo da empresa exibido no portal público e UI | **Manter público** | Acedido por portal anónimo (login screen). Tornar privado obriga a signed URL em cada visita. |
| `custom-fonts` | Fontes personalizadas carregadas em `<link>`/CSS | **Manter público** | CSS `@font-face` exige URL público; não contém PII. |
| `personal-images` | Fotos de team_members + clients | **Privar (P1, fora do P0)** | Foto pessoal pode ser PII. Mas privar implica refatorar todos os `<TeamAvatar>` para signed URLs. Proposta: **manter público no P0**, abrir tarefa P1 para migrar. |

→ **No P0 só fechamos `portal-uploads`.** Para os outros, deixamos comentário no migration e abrimos task.

---

## 1. Migration SQL completa (estrutura)

Vai ser **um só** ficheiro `supabase/migrations/<ts>_security_p0.sql` com blocos:

1. **BEGIN** + comentário cabeçalho.
2. Migração enum `app_role` (A.1).
3. Helpers SECURITY DEFINER (A.2).
4. Schema: `team_members` extra cols + `role_activity_log` + `client_assignments` + `commercial_sales.assigned_to` (C).
5. Triggers de audit (C).
6. Para cada tabela em D: `DROP POLICY IF EXISTS ...` (todas as SELECT antigas) + novas SELECT.
7. Storage: privar `portal-uploads` + drop+create policies (E.1).
8. Comentários `-- TODO P1` para `personal-images`.
9. **COMMIT**.

(Não colo tudo aqui para não esticar; já está rascunhado em D.1–D.10 e E.1.)

---

## 2. Patch de código

| Ficheiro | Mudança |
|---|---|
| `supabase/functions/portal-upload/index.ts` | **Novo** (E.2) |
| `supabase/functions/portal-signed-url/index.ts` | **Novo** — devolve signed URL para `portal-uploads` validando token |
| `supabase/config.toml` | + bloco `[functions.portal-upload]` `verify_jwt=false` e idem signed-url |
| `src/hooks/useAuth.tsx` | Estender `isOwner` com derivados: `isAdmin`, `isAccountant`, `isHr`, `isSales`, `isAdminStaff`, `isTeamMember`, `isViewer` (1 query a `user_roles`) |
| `src/hooks/usePermissions.tsx` | Mapear novo enum: `'member' → 'team_member'`. Suporte a roles acumulados |
| `src/components/portal/*Upload*.tsx` (quando voltar) | Chamar `functions.invoke('portal-upload')` em vez de `storage.from(...).upload` |
| `src/pages/PortalView.tsx` (loaders de materiais com URL) | Usar `portal-signed-url` para resolver `path`→URL |

Nada mais no frontend é forçoso no P0 — as RLS apenas restringem; UI continua a funcionar para owners (cenário atual single-tenant).

---

## 3. Testes manuais pós-aplicação

Criar 4 contas teste (owner já existe). Para cada, validar via UI + DevTools:

1. **owner@test** — acede a tudo: `/clientes` mostra NIF, `/equipa` mostra IBAN, `/financeiro` mostra payroll, `/definicoes/legal` mostra docs.
2. **admin@test** — igual a owner exceto `/definicoes/legal` → 403/lista vazia.
3. **accountant@test (is_external=true)**:
   - vê `/financeiro/saídas`, `/financeiro/entradas`, `/fornecedores`, NIF/NISS empresa em read-only
   - **NÃO** vê CRM, projetos, payroll de equipa interna (a não ser hr também)
   - Suspender (`access_suspended=true`) → próximo refresh todas as queries financeiras devolvem 0 rows. Resumir → volta ao normal.
   - Verificar `role_activity_log` regista suspend/resume.
4. **hr@test** — vê `/equipa` completo + `/financeiro/payroll`. Não vê CRM, não vê faturação.
5. **admin_staff@test** — vê `/clientes`, `/clientes/:id/contratos`, `/financeiro/entradas` (mas UI esconde colunas de custo). Não vê `/financeiro/saídas`, payroll, NIF empresa.
6. **sales@test** com 2 clientes atribuídos via `client_assignments`:
   - vê só esses 2 em `/clientes`
   - vê todos os `crm_leads` (sales = global) — **confirmar âmbito desejado**, alternativa: só os onde `responsible_id = self`
   - vê `commercial_sales` onde `assigned_to=self` ou `created_by=self`
7. **team_member@test** com profile membro do projeto X:
   - vê projeto X e cliente desse projeto, sem NIF/IBAN
   - **não** vê `/financeiro/*`, payroll de outros, contratos de outros
   - vê o **próprio** payroll e o **próprio** contrato
8. **viewer@test** — só agregados (página dashboard). Tabelas raw devolvem 0 rows.
9. **portal-uploads**:
   - `curl -X POST` direto ao bucket via SDK anon → 403
   - upload via edge `portal-upload` com token válido → 200 + ficheiro presente
   - upload com token inválido → 401
   - tentar `getPublicUrl` no frontend → URL devolve 400/403
10. **role_activity_log** — owner vê grelha; admin não.
11. **Performance smoke**: abrir `/clientes` com role `team_member` em conta com 50 clientes atribuídos — verificar <500ms.

---

## 4. Plano de rollback

Cada parte é reversível independentemente:

### Rollback total (script)
Guardar antes:
```sql
pg_dump --data-only --table=public.user_roles --table=public.team_members > backup_p0.sql
```
Em caso de catástrofe (login partido, RLS demasiado restritiva):

```sql
BEGIN;
-- 1. Repor enum
ALTER TYPE public.app_role RENAME TO app_role_p0;
CREATE TYPE public.app_role AS ENUM ('owner','admin','member');
ALTER TABLE public.user_roles ADD COLUMN role_old public.app_role;
UPDATE public.user_roles SET role_old = CASE
  WHEN role::text IN ('owner') THEN 'owner'::public.app_role
  WHEN role::text IN ('admin','accountant','hr','admin_staff','sales') THEN 'admin'::public.app_role
  ELSE 'member'::public.app_role END;
ALTER TABLE public.user_roles DROP COLUMN role;
ALTER TABLE public.user_roles RENAME COLUMN role_old TO role;
DROP TYPE public.app_role_p0;

-- 2. Restaurar policies SELECT permissivas (cópia das antigas — incluímos no migration como comentário no topo)
-- ... DROP novas + CREATE antigas (todas guardadas literalmente em comentário no início do migration) ...

-- 3. Reabrir bucket
UPDATE storage.buckets SET public=true WHERE id='portal-uploads';
CREATE POLICY "portal-uploads: authenticated can read" ON storage.objects FOR SELECT
  USING (bucket_id='portal-uploads');
COMMIT;
```

### Rollback parcial
- **Só roles** (manter RLS nova): mapear roles novos para apenas `owner`/`admin` na app sem migrar enum.
- **Só RLS de uma tabela**: `DROP POLICY` + recriar a antiga (que está comentada no topo do migration para referência).
- **Só portal-uploads**: `UPDATE storage.buckets SET public=true; CREATE POLICY ... FOR SELECT`.

### Mecanismo de segurança
- O migration começa com `SAVEPOINT` em torno de cada bloco grande para falhar atomicamente.
- Manter `mem://features/security-audit.md` atualizado após aplicação.
- Snapshot da BD via Cloud → Backups antes de correr.

---

## 5. Pontos a confirmar antes de aplicar

1. **Sales vê todos os leads ou só `responsible_id = self`?** Proposta acima: todos (departamento comercial). Confirma.
2. **`admin_staff` deve mesmo ver TODAS as faturas (`commercial_sales` global) ou só de clientes atribuídos?** Proposta: global, mas dá-se para apertar.
3. **`team_member` vê o salário do próprio (`financial_payroll where profile_id=me`)?** Proposta: sim. Confirma.
4. **Aceitas manter `personal-images` público no P0** (com TODO para P1)? Caso contrário, alargo o pacote.
5. **Migrar `app_role` "member" → "team_member"** automaticamente? (1 conta perde acesso de admin se estava como `admin`? Não, admins ficam `admin`.)

Aprova ou aponta ajustes para eu implementar de seguida.
