import { createClient } from 'jsr:@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const form = await req.formData();
    const token = String(form.get('portal_token') ?? '');
    const questionId = String(form.get('question_id') ?? 'general');
    const file = form.get('file') as File | null;

    if (!token || !file) return json({ error: 'missing portal_token or file' }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ error: 'file too large (max 20MB)' }, 413);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validar token via RPC já existente
    const { data: ok, error: tokenErr } = await admin.rpc('portal_token_active', { _token: token });
    if (tokenErr || !ok) return json({ error: 'invalid or inactive portal token' }, 401);

    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const path = `${token}/${questionId}/${Date.now()}-${safeName}`;

    const { error: upErr } = await admin.storage
      .from('portal-uploads')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: signed } = await admin.storage
      .from('portal-uploads')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    return json({ path, url: signed?.signedUrl ?? null, name: file.name });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});