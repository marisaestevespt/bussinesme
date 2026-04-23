// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { hasCompletePortalAccess, mergePortalAccessRows, resolvePublicPortal } from './portalAccess';

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
        show_materials: true,
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
          show_materials: true,
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
});