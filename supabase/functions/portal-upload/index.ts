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

// MIME types aceites pelo portal do cliente. Mantemos uma lista curta e
// explícita para reduzir superfície de ataque (sem .exe, .html, .svg, etc.).
const ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // xlsx
  'application/zip',
  'application/x-zip-compressed',
]);

/**
 * Sanitiza o nome de ficheiro:
 *  - Remove caracteres unicode invisíveis / control chars (XSS / spoofing).
 *  - Mantém apenas chars seguros para storage paths.
 *  - Garante extensão preservada e limite de 200 chars (margem para path total).
 */
function sanitizeFileName(raw: string): string {
  const stripped = (raw || 'ficheiro')
    // Remove zero-width, BOM, RTL/LTR markers, control chars
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .normalize('NFKC')
    .trim();

  // Separar extensão para garantir que não a perdemos no truncate.
  const dot = stripped.lastIndexOf('.');
  const base = dot > 0 ? stripped.slice(0, dot) : stripped;
  const ext = dot > 0 ? stripped.slice(dot).toLowerCase() : '';

  const safeBase = (base || 'ficheiro')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 200 - ext.length);

  const safeExt = ext.replace(/[^\w.]+/g, '');
  return (safeBase || 'ficheiro') + safeExt;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Rate limit: 20 uploads / minute per IP (anti-storage-flood)
  const rl = checkRateLimit(`portal-upload:${getClientId(req)}`, 20, 60);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const form = await req.formData();
    const token = String(form.get('portal_token') ?? '');
    const questionId = String(form.get('question_id') ?? 'general');
    const file = form.get('file') as File | null;

    if (!token || !file) return json({ error: 'missing portal_token or file' }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ error: 'file too large (max 20MB)' }, 413);

    // Validação do MIME — rejeita tudo o que não esteja na whitelist.
    if (!ALLOWED_MIME.has(file.type)) {
      return json(
        {
          error: 'unsupported file type',
          received: file.type,
          allowed: Array.from(ALLOWED_MIME),
        },
        415,
      );
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validar token via RPC já existente
    const { data: ok, error: tokenErr } = await admin.rpc('portal_token_active', { _token: token });
    if (tokenErr || !ok) return json({ error: 'invalid or inactive portal token' }, 401);

    const safeName = sanitizeFileName(file.name);
    const path = `${token}/${questionId}/${Date.now()}-${safeName}`;

    const { error: upErr } = await admin.storage
      .from('portal-uploads')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: signed } = await admin.storage
      .from('portal-uploads')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    return json({ path, url: signed?.signedUrl ?? null, name: safeName });
  } catch (e) {
    console.error('[portal-upload] error', e);
    return json({ error: 'internal_error' }, 500);
  }
});