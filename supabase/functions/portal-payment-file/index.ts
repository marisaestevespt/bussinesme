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
 * Short-lived signed URL for an invoice/payment document, gated by the supplied
 * portal token. The `financial-files` bucket is private — anon portal users
 * cannot read it directly, so we validate access server-side via
 * `get_portal_payment_file_path` and sign a 5-minute URL.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const rl = checkRateLimit(`portal-payment-file:${getClientId(req)}`, 60, 60);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  let body: { token?: string; sale_id?: string; file_url?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const token = (body.token || '').trim();
  const saleId = (body.sale_id || '').trim();
  const fileUrl = (body.file_url || '').trim();
  if (!token || !saleId || !fileUrl) return json({ error: 'missing_params' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(url, serviceKey);

  const { data: path, error } = await sb.rpc('get_portal_payment_file_path', {
    _token: token,
    _sale_id: saleId,
    _file_url: fileUrl,
  });
  if (error) {
    console.error('[portal-payment-file] RPC error', error);
    return json({ error: 'internal_error' }, 500);
  }
  if (!path) return json({ error: 'not_found' }, 404);

  const { data: signed, error: signErr } = await sb.storage
    .from('financial-files')
    .createSignedUrl(path as string, 60 * 5);
  if (signErr || !signed?.signedUrl) {
    console.error('[portal-payment-file] sign error', signErr);
    return json({ error: 'internal_error' }, 500);
  }

  return json({ url: signed.signedUrl });
});