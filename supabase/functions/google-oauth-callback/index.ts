import { corsHeaders } from '@supabase/supabase-js/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') || 'https://bussinesme.lovable.app';

function htmlRedirect(target: string, msg: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${msg}</title>
    <meta http-equiv="refresh" content="2;url=${target}">
    <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;background:#fafafa}</style>
    </head><body><div><h2>${msg}</h2><p>A redirecionar… <a href="${target}">clica aqui se não fores reencaminhado</a></p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) return htmlRedirect(`${APP_URL}/configuracoes?gcal_error=${encodeURIComponent(error)}`, 'Ligação cancelada');
    if (!code || !state) return htmlRedirect(`${APP_URL}/configuracoes?gcal_error=missing_params`, 'Erro na ligação');

    let userId = '', returnTo = '/configuracoes';
    try {
      const decoded = atob(state);
      const [uid, ret] = decoded.split('|');
      userId = uid; returnTo = ret || returnTo;
    } catch {
      return htmlRedirect(`${APP_URL}/configuracoes?gcal_error=bad_state`, 'Estado inválido');
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

    // Trocar code por tokens
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error('Token exchange failed', tokenData);
      return htmlRedirect(`${APP_URL}${returnTo}?gcal_error=token_exchange`, 'Erro ao obter tokens');
    }

    // Obter info do utilizador Google
    const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoResp.json();
    if (!userInfoResp.ok || !userInfo.email) {
      return htmlRedirect(`${APP_URL}${returnTo}?gcal_error=userinfo`, 'Erro ao obter conta');
    }

    const email: string = userInfo.email;
    const domain = email.split('@')[1] || '';
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verificar domínio permitido (se houver lista configurada)
    const { data: settings } = await admin
      .from('google_calendar_settings').select('allowed_domains').limit(1).single();
    const allowed: string[] = settings?.allowed_domains || [];
    if (allowed.length > 0 && !allowed.includes(domain)) {
      return htmlRedirect(
        `${APP_URL}${returnTo}?gcal_error=domain_not_allowed&domain=${encodeURIComponent(domain)}`,
        `Domínio ${domain} não autorizado`,
      );
    }

    // Upsert da conta
    const { error: upsertErr } = await admin
      .from('google_calendar_accounts')
      .upsert({
        email, domain,
        display_name: userInfo.name || email,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token, // só vem na 1ª autorização
        token_expires_at: expiresAt,
        scope: tokenData.scope,
        is_active: true,
        connected_by: userId || null,
        last_sync_error: null,
      }, { onConflict: 'email' });

    if (upsertErr) {
      console.error('Upsert error', upsertErr);
      return htmlRedirect(`${APP_URL}${returnTo}?gcal_error=db`, 'Erro a guardar conta');
    }

    return htmlRedirect(`${APP_URL}${returnTo}?gcal_success=${encodeURIComponent(email)}`, `Conta ${email} ligada com sucesso`);
  } catch (err) {
    console.error('callback error', err);
    return htmlRedirect(`${APP_URL}/configuracoes?gcal_error=internal`, 'Erro interno');
  }
});