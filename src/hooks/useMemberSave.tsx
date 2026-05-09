import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cleanPayloadStrip as cleanPayload } from '@/lib/utils';
import { vatBreakdown, VAT_DEFAULT_RATE } from '@/lib/payrollCalculations';
import type { TablesInsert } from '@/integrations/supabase/types';

type MemberFormPayload = Record<string, unknown> & {
  id?: string;
  full_name?: string;
  email?: string;
  identification?: string | null;
  whatsapp?: string | null;
  iban?: string | null;
  fiscal_address?: string | null;
  role_title?: string | null;
  work_schedule?: string | null;
  departments?: string[];
  sensitiveAccess?: Record<string, boolean>;
  system_role?: string;
  profile_id?: string | null;
  birthday?: string | null;
};

type ContractFormPayload = Record<string, unknown> & {
  id?: string;
  contract_type?: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  monthly_value?: string | number;
  contracted_hours?: string | number | null;
  payment_day?: string | number;
  document_url?: string | null;
  notes?: string | null;
  value_includes_vat?: boolean;
  use_custom_payment_start?: boolean;
  payment_start_date?: string | null;
  duration?: string;
  ss_employer_rate?: number | string;
  payment_method?: string | null;
};

type ExpenseInsertPayload = TablesInsert<'financial_expenses'> & { supplier_id?: string };

export interface SupplierDraft {
  name: string;
  nif: string;
  email: string;
  phone: string;
  iban: string;
  address: string;
  payment_method: string;
  default_vat_rate: number;
  service: string;
  category: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
}

export interface PrestadorPendingReview {
  memberId: string;
  memberName: string;
  contract: ContractFormPayload;
  draft: SupplierDraft;
}

export interface SaveMemberResult {
  memberId: string | undefined;
  isNew: boolean;
  prestadorPending: PrestadorPendingReview | null;
}

// Module keys that belong to each department
const ALL_DEPT_MODULES = ['marketing', 'comercial', 'clientes', 'financeiro', 'operacao', 'produtos', 'recursos-humanos', 'equipa', 'planeamento', 'weekly-align', 'gestao-equipa-ceo'];

const DEPT_MODULE_MAP: Record<string, string[]> = {
  admin: ALL_DEPT_MODULES,
  marketing: ['marketing'],
  comercial: ['comercial'],
  clientes: ['clientes'],
  financeiro: ['financeiro'],
  operacao: ['operacao'],
  produtos: ['produtos'],
  'recursos-humanos': ['recursos-humanos'],
};

const HALL_MODULES = ['comeca-aqui', 'mural', 'hub-equipa'];
const TRANSVERSAL_MODULES = ['agenda', 'reunioes', 'acessos', 'projetos', 'processos', 'tarefas', 'biblioteca'];
const SECRETARIA_MODULES = ['secretaria'];

// cleanPayload imported from utils as cleanPayloadStrip

async function autoAssignPermissions(memberId: string, departments: string[]) {
  if (!departments || departments.length === 0) return;

  const allModuleKeys = new Set([
    ...HALL_MODULES,
    ...TRANSVERSAL_MODULES,
    ...SECRETARIA_MODULES,
  ]);
  for (const dept of departments) {
    (DEPT_MODULE_MAP[dept] || []).forEach(mk => allModuleKeys.add(mk));
  }

  const roleName = `dept_${departments.sort().join('_')}`;
  let { data: role } = await supabase.from('custom_roles').select('id').eq('name', roleName).maybeSingle();
  
  if (!role) {
    const { data: newRole, error } = await supabase.from('custom_roles').insert({ name: roleName, description: `Auto-generated role for ${departments.join(', ')}` }).select('id').single();
    if (error || !newRole) return;
    role = newRole;

    const perms = [...allModuleKeys].map(mk => ({ custom_role_id: role!.id, module_key: mk, can_view: true }));
    await supabase.from('role_permissions').insert(perms);
  }

  await supabase.from('team_members').update({ custom_role_id: role.id } as Partial<TablesInsert<'team_members'>>).eq('id', memberId);
}

export function useMemberSave() {
  const qc = useQueryClient();

  const saveMember = async ({ member, contract: contractData }: { member: MemberFormPayload; contract: ContractFormPayload | null }): Promise<SaveMemberResult | undefined> => {
    try {
      const isNew = !member.id;
      let memberId = member.id;
      let prestadorPending: PrestadorPendingReview | null = null;

      // Strip transient UI-only fields before DB operations
      const { sensitiveAccess: _sa, system_role: _sr, ...dbFields } = member;
      const systemRole: string | undefined = member.system_role;

      // Derive fields that are no longer edited directly in the form
      const depts: string[] = Array.isArray(member.departments) && member.departments.length > 0
        ? (member.departments as string[])
        : [];
      const ct = (contractData?.contract_type as string) || 'contrato_trabalho';
      const derivedMemberType =
        ct === 'contrato_prestacao' || ct === 'prestacao_servicos' ? 'prestador_servicos'
        : ct === 'acordo' ? 'colaborador_fixo' // sócio também usa colaborador_fixo (CHECK constraint)
        : 'colaborador_fixo';
      const contractStatus = (contractData?.status as string) || 'ativo';
      const derivedMemberStatus =
        contractStatus === 'ativo' || contractStatus === 'em_renovacao' ? 'ativo'
        : contractStatus === 'terminado' ? 'inativo'
        : (member as any).status || 'ativo';

      // Mirror legacy columns on team_members so other readers (FinPayroll etc.) keep working
      const derived: Record<string, unknown> = {
        department: depts[0] || null,
        departments: depts,
        work_areas: depts,
        member_type: derivedMemberType,
        status: derivedMemberStatus,
        start_date: contractData?.start_date || null,
        ss_employer_rate: contractData?.ss_employer_rate ?? 0.2375,
        payment_method: contractData?.payment_method ?? null,
      };

      if (isNew) {
        const payload = cleanPayload({ ...dbFields, ...derived });
        delete payload.id;
        const { data, error } = await supabase.from('team_members').insert(payload as unknown as TablesInsert<'team_members'>).select('id').single();
        if (error) throw error;
        memberId = data.id;
      } else {
        const payload = cleanPayload({ ...dbFields, ...derived });
        const { error } = await supabase.from('team_members').update(payload as unknown as Partial<TablesInsert<'team_members'>>).eq('id', member.id!);
        if (error) throw error;
      }

      // Auto-assign permissions based on departments
      if (depts.length > 0) {
        await autoAssignPermissions(memberId, depts);
      }

      // Handle contract: create for new, update for existing
      if (contractData && memberId) {
        const monthlyVal = parseFloat(String(contractData.monthly_value ?? '')) || 0;
        const paymentDay = parseInt(String(contractData.payment_day ?? '')) || 1;
        const contractedHoursStr = contractData.contracted_hours != null && contractData.contracted_hours !== ''
          ? String(contractData.contracted_hours)
          : null;
        // Aceitar ambos os aliases (legacy `prestacao_servicos` ainda aparece em contratos existentes)
        const isPrestacao = contractData.contract_type === 'contrato_prestacao'
          || contractData.contract_type === 'prestacao_servicos';

        // Block contract type change away from prestação if member is the configured accountant
        if (!isNew && contractData.id && !isPrestacao) {
          const { data: existingContract } = await supabase
            .from('member_contracts')
            .select('contract_type')
            .eq('id', contractData.id)
            .maybeSingle();
          if (existingContract?.contract_type === 'contrato_prestacao') {
            const { data: bs } = await supabase
              .from('business_settings')
              .select('accountant_member_id')
              .limit(1)
              .maybeSingle();
            if (bs?.accountant_member_id === memberId) {
              toast.error('Não podes mudar o tipo de contrato deste membro porque está definido como contabilista. Remove-o em Definições > Fiscal primeiro.');
              return;
            }
          }
        }

        if (isNew) {
          // Create contract + payments for new members
          await supabase.from('member_contracts').insert({
            member_id: memberId!, contract_type: contractData.contract_type,
            start_date: contractData.start_date || null, end_date: contractData.end_date || null,
            status: contractData.status, monthly_value: monthlyVal,
            contracted_hours: contractedHoursStr, payment_day: paymentDay,
            document_url: contractData.document_url || null,
            notes: contractData.notes || null,
            value_includes_vat: !!contractData.value_includes_vat,
            payment_start_date: contractData.use_custom_payment_start ? (contractData.payment_start_date || null) : null,
            use_custom_payment_start: !!contractData.use_custom_payment_start,
            ss_employer_rate: Number(contractData.ss_employer_rate ?? 0.2375),
            payment_method: contractData.payment_method || null,
          });

          // Generate payments
          let numPayments = 0;
          if (contractData.duration === 'unica') numPayments = 1;
          else if (contractData.duration === 'indefinido') numPayments = 12;
          else numPayments = parseInt(contractData.duration) || 0;

          if (numPayments > 0 && contractData.start_date) {
            // Determine payment start date
            const paymentStartStr = (isPrestacao && contractData.use_custom_payment_start && contractData.payment_start_date)
              ? contractData.payment_start_date
              : contractData.start_date;
            const startDate = new Date(paymentStartStr);

            // Calculate IVA values for prestadores (centralized in payrollCalculations)
            let baseValue = monthlyVal;
            let vatRate = 0;
            let totalWithVat = monthlyVal;
            if (isPrestacao) {
              const v = vatBreakdown(monthlyVal, VAT_DEFAULT_RATE, !!contractData.value_includes_vat);
              baseValue = v.baseValue;
              vatRate = v.vatRate;
              totalWithVat = v.totalWithVat;
            }

            const payments: { member_id: string; month: number; year: number; gross_value: number; net_value: number; payment_type: string; status: string }[] = [];
            for (let i = 0; i < numPayments; i++) {
              const payMonth = ((startDate.getMonth() + i) % 12) + 1;
              const payYear = startDate.getFullYear() + Math.floor((startDate.getMonth() + i) / 12);
              payments.push({
                member_id: memberId, month: payMonth, year: payYear,
                gross_value: monthlyVal, net_value: monthlyVal,
                payment_type: isPrestacao ? 'prestacao' : 'salario',
                status: 'por_pagar',
              });
            }
            await supabase.from('member_payments').insert(payments);

            if (isPrestacao) {
              // Não criamos despesas/supplier aqui — vamos abrir um dialog
              // de revisão da ficha de fornecedor depois de gravar o membro.
              prestadorPending = {
                memberId: memberId!,
                memberName: String(member.full_name || ''),
                contract: contractData,
                draft: {
                  name: String(member.full_name || ''),
                  nif: String(member.identification || ''),
                  email: String(member.email || ''),
                  phone: String(member.whatsapp || ''),
                  iban: String(member.iban || ''),
                  address: String(member.fiscal_address || ''),
                  payment_method: String((contractData?.payment_method as string) || 'transferencia'),
                  default_vat_rate: 23,
                  service: String(member.role_title || 'Prestação de serviços'),
                  category: 'freelancer',
                  contract_start_date: contractData.start_date || null,
                  contract_end_date: contractData.end_date || null,
                },
              };
            } else {
              // === AUTO-CREATE FINANCIAL_EXPENSES (apenas para ordenados) ===
              for (const p of payments) {
              const expMonth = p.month;
              const expQuarter = Math.ceil(expMonth / 3);
              const expDate = `${p.year}-${String(p.month).padStart(2, '0')}-${String(paymentDay).padStart(2, '0')}`;

              const expensePayload: ExpenseInsertPayload = {
                description: `Pagamento — ${member.full_name} — ${String(p.month).padStart(2, '0')}/${p.year}`,
                category: 'ordenados',
                base_value: p.gross_value,
                vat_rate: 0,
                total_with_vat: p.gross_value,
                expense_date: expDate,
                status: 'por_pagar',
                source_type: 'payroll',
                expense_month: expMonth,
                expense_quarter: expQuarter,
                expense_year: p.year,
                location: 'portugal',
              };

              const { data: expData, error: expError } = await supabase
                .from('financial_expenses')
                .insert(expensePayload)
                .select('id')
                .single();

              // Create payroll entry linked to expense
              if (!expError && expData) {
                  await supabase.from('financial_payroll').insert({
                    collaborator_name: member.full_name,
                    month: p.month, year: p.year,
                    gross_salary: p.gross_value, net_salary: p.net_value,
                    total_cost: p.gross_value, status: 'por_pagar',
                    withholding_rate: 0, withholding_value: 0,
                    ss_employee: 0, ss_employer: 0,
                    expense_id: expData.id,
                  });
              }
              }
            }
            // Mantemos baseValue/vatRate/totalWithVat só para o ramo de ordenados
            void baseValue; void vatRate; void totalWithVat;
          }
        } else if (contractData.id) {
          // Update existing contract
          await supabase.from('member_contracts').update({
            contract_type: contractData.contract_type,
            start_date: contractData.start_date || null,
            end_date: contractData.end_date || null,
            status: contractData.status,
            monthly_value: monthlyVal,
            contracted_hours: contractedHoursStr,
            payment_day: paymentDay,
            document_url: contractData.document_url || null,
            notes: contractData.notes || null,
            value_includes_vat: !!contractData.value_includes_vat,
            payment_start_date: contractData.use_custom_payment_start ? (contractData.payment_start_date || null) : null,
            use_custom_payment_start: !!contractData.use_custom_payment_start,
            ss_employer_rate: Number(contractData.ss_employer_rate ?? 0.2375),
            payment_method: contractData.payment_method || null,
          }).eq('id', contractData.id);
        } else if (!isNew) {
          // No existing contract but editing — create one
          await supabase.from('member_contracts').insert({
            member_id: memberId!, contract_type: contractData.contract_type,
            start_date: contractData.start_date || null, end_date: contractData.end_date || null,
            status: contractData.status, monthly_value: monthlyVal,
            contracted_hours: contractedHoursStr, payment_day: paymentDay,
            document_url: contractData.document_url || null,
            notes: contractData.notes || null,
            value_includes_vat: !!contractData.value_includes_vat,
            payment_start_date: contractData.use_custom_payment_start ? (contractData.payment_start_date || null) : null,
            use_custom_payment_start: !!contractData.use_custom_payment_start,
            ss_employer_rate: Number(contractData.ss_employer_rate ?? 0.2375),
            payment_method: contractData.payment_method || null,
          });
        }
      }

      // Create auth account for new members with email
      if (isNew && member.email?.trim()) {
        try {
          const { data: authData, error: authError } = await supabase.functions.invoke('create-member', {
            body: {
              email: member.email.trim(),
              full_name: member.full_name,
              role_title: member.role_title || null,
              phone: member.whatsapp || null,
              work_schedule: member.work_schedule || null,
              team_member_id: memberId,
              department: depts[0] || null,
            },
          });
          if (authError) {
            console.error('Create member auth error:', authError);
            toast.error('Membro criado mas sem conta de acesso: ' + (authError.message || 'erro'));
          } else if (authData?.success) {
            if (authData.profile_id) {
              await supabase.from('team_members').update({ profile_id: authData.profile_id }).eq('id', memberId);
              if (depts.length > 0) {
                await autoAssignPermissions(memberId, depts);
              }
            }
            if (authData.onboarding_warning) {
              toast.warning(authData.onboarding_warning, { duration: 10000 });
            } else if (authData.onboarding_created) {
              toast.success('Checklist de onboarding criada automaticamente!', { duration: 5000 });
            }
            if (authData.invite_url) {
              await navigator.clipboard.writeText(authData.invite_url);
              toast.success(
                authData.email_sent
                  ? 'Conta criada! Email de convite enviado e link copiado para a área de transferência.'
                  : 'Conta criada! Link de convite copiado para a área de transferência.',
                { duration: 8000 }
              );
            } else if (authData.email_sent) {
              toast.success('Conta criada! Email de convite enviado com sucesso.');
            } else {
              toast.success('Conta de acesso criada com sucesso!');
            }
          }
        } catch (authErr: unknown) {
          console.error('Auth creation failed:', authErr);
          toast.error('Membro criado mas sem conta de acesso');
        }
      }

      // Save sensitive access toggles
      const sensitiveAccess: Record<string, boolean> = member.sensitiveAccess || {};
      const sensitiveRows = Object.entries(sensitiveAccess).map(([category, granted]) => ({
        member_id: memberId,
        category,
        granted: !!granted,
      }));
      if (sensitiveRows.length > 0) {
        await supabase.from('member_sensitive_access').upsert(sensitiveRows, { onConflict: 'member_id,category' });
      }

      // Save system role (RBAC) — só se conseguirmos descobrir o user_id ligado a este membro
      if (systemRole) {
        let profileId: string | null = member.profile_id || null;
        if (!profileId && memberId) {
          const { data: tm } = await supabase.from('team_members').select('profile_id').eq('id', memberId).maybeSingle();
          profileId = tm?.profile_id || null;
        }
        if (profileId) {
          const { data: prof } = await supabase.from('profiles').select('user_id').eq('id', profileId).maybeSingle();
          const userId = prof?.user_id;
          if (userId) {
            // Não tocar em owners — só substituir roles não-owner
            const { data: existing } = await supabase.from('user_roles').select('role').eq('user_id', userId);
            const isOwner = (existing || []).some((r) => r.role === 'owner');
            if (!isOwner) {
              await supabase.from('user_roles').delete().eq('user_id', userId).neq('role', 'owner');
              await supabase.from('user_roles').insert({ user_id: userId, role: systemRole as TablesInsert<'user_roles'>['role'] });
            }
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['team'] });
      if (!prestadorPending) {
        toast.success(isNew ? 'Membro criado com contrato e pagamentos!' : 'Membro atualizado');
      }
      return { memberId, isNew, prestadorPending };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao guardar: ' + msg);
      return undefined;
    }
  };

  /**
   * Cria o supplier ligado ao membro e gera as despesas (com IVA) e linhas
   * em financial_contractors para todos os pagamentos futuros já gerados em
   * member_payments. Chamado depois de o owner confirmar o dialog de revisão.
   */
  const finalizeSupplierForPrestador = async ({
    memberId,
    memberName,
    contract,
    supplier,
  }: {
    memberId: string;
    memberName: string;
    contract: ContractFormPayload;
    supplier: SupplierDraft;
  }): Promise<boolean> => {
    try {
      const paymentDay = parseInt(String(contract.payment_day ?? '')) || 1;
      const includesVat = !!contract.value_includes_vat;
      const vatRate = Number(supplier.default_vat_rate) || 0;

      // 1) supplier
      const { data: supplierData, error: supplierErr } = await supabase
        .from('suppliers')
        .insert({
          name: supplier.name || memberName,
          nif: supplier.nif || null,
          email: supplier.email || null,
          phone: supplier.phone || null,
          iban: supplier.iban || null,
          address: supplier.address || null,
          category: supplier.category || 'freelancer',
          payment_method: supplier.payment_method || null,
          default_vat_rate: vatRate,
          contract_start_date: supplier.contract_start_date,
          contract_end_date: supplier.contract_end_date,
          is_active: true,
          member_id: memberId,
          department: (supplier as any).department || null,
        } as TablesInsert<'suppliers'>)
        .select('id')
        .single();
      if (supplierErr || !supplierData) {
        throw supplierErr ?? new Error('Falha a criar fornecedor');
      }
      const supplierId = supplierData.id;

      // 2) generate financial_expenses + financial_contractors for every
      //    member_payment that doesn't yet have a matching contractor expense
      const { data: pays = [] } = await supabase
        .from('member_payments')
        .select('id, month, year, gross_value, net_value')
        .eq('member_id', memberId);

      for (const p of pays || []) {
        // Skip se já houver uma despesa contractor para este mês
        const { data: exists } = await supabase
          .from('financial_expenses')
          .select('id')
          .eq('member_id', memberId)
          .eq('expense_month', p.month)
          .eq('expense_year', p.year)
          .eq('source_type', 'contractor')
          .maybeSingle();
        if (exists) continue;

        const v = vatBreakdown(Number(p.gross_value) || 0, vatRate, includesVat);
        const expMonth = p.month;
        const expQuarter = Math.ceil(expMonth / 3);
        const expDate = `${p.year}-${String(p.month).padStart(2, '0')}-${String(paymentDay).padStart(2, '0')}`;

        const expensePayload: ExpenseInsertPayload = {
          description: `Pagamento — ${memberName} — ${String(p.month).padStart(2, '0')}/${p.year}`,
          category: 'prestadores',
          base_value: v.baseValue,
          vat_rate: v.vatRate,
          total_with_vat: v.totalWithVat,
          expense_date: expDate,
          status: 'por_pagar',
          source_type: 'contractor',
          expense_month: expMonth,
          expense_quarter: expQuarter,
          expense_year: p.year,
          location: 'portugal',
          supplier_id: supplierId,
          member_id: memberId,
        } as ExpenseInsertPayload;

        const { data: expData, error: expError } = await supabase
          .from('financial_expenses')
          .insert(expensePayload)
          .select('id')
          .single();
        if (!expError && expData) {
          await supabase.from('financial_contractors').insert({
            contractor_name: memberName,
            month: p.month,
            year: p.year,
            value: v.totalWithVat,
            service: supplier.service || 'Prestação de serviços',
            location: 'portugal',
            status: 'por_pagar',
            expense_id: expData.id,
          } satisfies TablesInsert<'financial_contractors'>);
        }
      }

      qc.invalidateQueries({ queryKey: ['team'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['financial-expenses'] });
      toast.success('Fornecedor criado e pagamentos gerados com IVA!');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro a criar fornecedor: ' + msg);
      return false;
    }
  };

  return { saveMember, finalizeSupplierForPrestador };
}
