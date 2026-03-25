import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cleanPayloadStrip as cleanPayload } from '@/lib/utils';

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

  const { data: tm } = await supabase.from('team_members').select('profile_id').eq('id', memberId).maybeSingle();
  if (!tm?.profile_id) return;

  const { data: profile } = await supabase.from('profiles').select('user_id').eq('id', tm.profile_id).maybeSingle();
  if (!profile?.user_id) return;

  const { data: existingMember } = await supabase.from('members').select('id').eq('user_id', profile.user_id).maybeSingle();
  if (existingMember) {
    await supabase.from('members').update({ custom_role_id: role.id }).eq('id', existingMember.id);
  } else {
    await supabase.from('members').insert({ user_id: profile.user_id, custom_role_id: role.id });
  }
}

export function useMemberSave() {
  const qc = useQueryClient();

  const saveMember = async ({ member, contract: contractData }: { member: any; contract: any }) => {
    try {
      const isNew = !member.id;
      let memberId = member.id;

      if (isNew) {
        const payload = cleanPayload({ ...member });
        delete payload.id;
        const { data, error } = await supabase.from('team_members').insert(payload as any).select('id').single();
        if (error) throw error;
        memberId = data.id;
      } else {
        const payload = cleanPayload(member);
        const { error } = await supabase.from('team_members').update(payload as any).eq('id', member.id);
        if (error) throw error;
      }

      // Auto-assign permissions based on departments
      const depts: string[] = Array.isArray(member.departments) && member.departments.length > 0
        ? member.departments
        : (member.department ? [member.department] : []);
      if (depts.length > 0) {
        await autoAssignPermissions(memberId, depts);
      }

      // Create contract + payments for new members
      if (isNew && contractData && memberId) {
        const monthlyVal = parseFloat(contractData.monthly_value) || 0;
        const paymentDay = parseInt(contractData.payment_day) || 1;
        await supabase.from('member_contracts').insert({
          member_id: memberId, contract_type: contractData.contract_type,
          start_date: contractData.start_date || null, end_date: contractData.end_date || null,
          status: contractData.status, monthly_value: monthlyVal,
          contracted_hours: contractData.contracted_hours || null, payment_day: paymentDay,
        });
        let numPayments = 0;
        if (contractData.duration === 'unica') numPayments = 1;
        else if (contractData.duration === 'indefinido') numPayments = 12;
        else numPayments = parseInt(contractData.duration) || 0;
        if (numPayments > 0 && contractData.start_date) {
          const startDate = new Date(contractData.start_date);
          const payments = [];
          for (let i = 0; i < numPayments; i++) {
            const payMonth = ((startDate.getMonth() + i) % 12) + 1;
            const payYear = startDate.getFullYear() + Math.floor((startDate.getMonth() + i) / 12);
            payments.push({
              member_id: memberId, month: payMonth, year: payYear,
              gross_value: monthlyVal, net_value: monthlyVal,
              payment_type: contractData.contract_type === 'contrato_prestacao' ? 'prestacao' : 'salario',
              status: 'por_pagar',
            });
          }
          await supabase.from('member_payments').insert(payments);
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
              department: member.department || null,
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
              toast.success('Conta criada! Link de convite copiado para a área de transferência.', { duration: 8000 });
            } else {
              toast.success('Conta de acesso criada com sucesso!');
            }
          }
        } catch (authErr: any) {
          console.error('Auth creation failed:', authErr);
          toast.error('Membro criado mas sem conta de acesso');
        }
      }

      // Apply inline extra pages
      const deptExtraPages: Record<string, string[]> = member.deptExtraPages || {};
      const allExtraModules = new Set<string>();
      Object.values(deptExtraPages).forEach(pages => pages.forEach(p => allExtraModules.add(p)));
      if (allExtraModules.size > 0) {
        const roleName = `dept_${[...depts].sort().join('_')}`;
        const { data: role } = await supabase.from('custom_roles').select('id').eq('name', roleName).maybeSingle();
        if (role) {
          const perms = [...allExtraModules].map(mk => ({ custom_role_id: role.id, module_key: mk, can_view: true }));
          await supabase.from('role_permissions').upsert(perms, { onConflict: 'custom_role_id,module_key' });
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

      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(isNew ? 'Membro criado com contrato e pagamentos!' : 'Membro atualizado');
    } catch (err: any) {
      toast.error('Erro ao guardar: ' + (err.message || err));
    }
  };

  return { saveMember };
}
