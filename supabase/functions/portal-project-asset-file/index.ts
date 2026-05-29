import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, getClientId, rateLimitResponse } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Short-lived signed URL for a project asset file (page_key='entregaveis'),
 * gated by the supplied portal token via get_portal_project_asset_file_url.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const rl = checkRateLimit(`portal-asset-file:${getClientId(req)}`, 60, 60);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  let body: { token?: string; asset_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const token = (body.token || '').trim();
  const assetId = (body.asset_id || '').trim();
  if (!token || !assetId) return json({ error: 'missing_params' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(url, serviceKey);

  const { data: path, error } = await sb.rpc('get_portal_project_asset_file_url', {
    _token: token,
    _asset_id: assetId,
  });
  if (error) {
    console.error('[portal-project-asset-file] RPC error', error);
    return json({ error: 'internal_error' }, 500);
  }
  if (!path) return json({ error: 'not_found' }, 404);

  const { data: signed, error: signErr } = await sb.storage
    .from('project-assets')
    .createSignedUrl(path as string, 60 * 5);
  if (signErr || !signed?.signedUrl) {
    console.error('[portal-project-asset-file] sign error', signErr);
    return json({ error: 'internal_error' }, 500);
  }

  return json({ url: signed.signedUrl });
});