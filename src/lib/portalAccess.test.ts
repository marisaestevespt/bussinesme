// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PUBLIC_PORTAL_KEYS, hasCompletePortalAccess, mergePortalAccessRows, resolvePublicPortal } from './portalAccess';

const parseReturnedColumns = (returns: string) =>
  Array.from(returns.matchAll(/\b([a-z_][a-z0-9_]*)\s+(?:uuid|boolean|text|integer|bigint|numeric|jsonb|timestamp|timestamptz)/gi)).map((m) => m[1]);

const getLatestPortalFunctionReturns = (functionName: 'get_portal_by_slug' | 'get_portal_by_token') => {
  const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  let latest: string | null = null;

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const regex = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${functionName}[\\s\\S]*?RETURNS\\s+TABLE\\s*\\(([^;]*?)\\)`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sql))) latest = match[1];
  }

  return latest;
};

describe('portalAccess', () => {
  it('identifica quando a resposta pública por slug vem incompleta', () => {
    expect(hasCompletePortalAccess({ id: '1', token: '2', is_active: true, client_id: '3' })).toBe(false);
  });

  it('recompõe um portal completo com fallback ao token', () => {
    const merged = mergePortalAccessRows(
      { id: '1', token: 'tok', is_active: true, client_id: '3', slug: 'clever-counts' },
      {
        id: '1',
        token: 'tok',
        is_active: true,
        client_id: '3',
        show_onboarding: true,
        show_timeline: true,
        show_payments: true,
        show_meetings: true,
        show_faqs: true,
        show_monthly_summary: true,
        show_workspace: true,
        portal_type: 'projeto_unico',
        slug: 'clever-counts',
      },
    );

    expect(merged).toMatchObject({
      slug: 'clever-counts',
      show_onboarding: true,
      show_workspace: true,
      portal_type: 'projeto_unico',
    });
  });

  it('quando o slug vem incompleto, volta a pedir por token e devolve o portal completo', async () => {
    const rpc = vi.fn(async (fn: 'get_portal_by_slug' | 'get_portal_by_token') => {
      if (fn === 'get_portal_by_slug') {
        return {
          data: [{ id: '1', token: 'tok', is_active: true, client_id: '3', slug: 'clever-counts' }],
        };
      }

      return {
        data: [{
          id: '1',
          token: 'tok',
          is_active: true,
          client_id: '3',
          show_onboarding: true,
          show_timeline: true,
          show_payments: true,
          show_meetings: true,
          show_faqs: true,
          show_monthly_summary: true,
          show_workspace: true,
          portal_type: 'projeto_unico',
          slug: 'clever-counts',
        }],
      };
    });

    const portal = await resolvePublicPortal('clever-counts', rpc);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(portal).toMatchObject({
      token: 'tok',
      slug: 'clever-counts',
      show_onboarding: true,
      show_workspace: true,
      portal_type: 'projeto_unico',
    });
  });

  it('mantém o contrato público do portal alinhado com as funções da base de dados', () => {
    for (const functionName of ['get_portal_by_slug', 'get_portal_by_token'] as const) {
      const returns = getLatestPortalFunctionReturns(functionName);
      expect(returns, `${functionName} precisa de RETURNS TABLE nas migrações`).toBeTruthy();

      const returnedColumns = parseReturnedColumns(returns ?? '');
      expect(returnedColumns).toEqual(expect.arrayContaining([...PUBLIC_PORTAL_KEYS]));
    }
  });
});