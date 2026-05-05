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
 * Returns a short-lived signed URL for a deliverable file, but only when the
 * supplied portal token actually has access to that deliverable. Validation is
 * delegated to `get_portal_deliverable_file_url` which returns the file path
 * after applying RLS-equivalent checks.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Rate limit: 60 requests / minute per IP (anti-enumeration of deliverable IDs)
  const rl = checkRateLimit(`portal-file:${getClientId(req)}`, 60, 60);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  let body: { token?: string; deliverable_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const token = (body.token || '').trim();
  const deliverableId = (body.deliverable_id || '').trim();
  if (!token || !deliverableId) return json({ error: 'missing_params' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(url, serviceKey);

  const { data: path, error } = await sb.rpc('get_portal_deliverable_file_url', {
    _token: token,
    _deliverable_id: deliverableId,
  });
  if (error) {
    console.error('[portal-deliverable-file] RPC error', error);
    return json({ error: 'internal_error' }, 500);
  }
  if (!path) return json({ error: 'not_found' }, 404);

  const { data: signed, error: signErr } = await sb.storage
    .from('deliverable-documents')
    .createSignedUrl(path as string, 60 * 5);
  if (signErr || !signed?.signedUrl) {
    console.error('[portal-deliverable-file] sign error', signErr);
    return json({ error: 'internal_error' }, 500);
  }

  return json({ url: signed.signedUrl });
});