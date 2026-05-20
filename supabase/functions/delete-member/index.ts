import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "owner",
    });
    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Apenas o owner pode eliminar membros" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { team_member_id } = await req.json();
    if (!team_member_id) {
      return new Response(JSON.stringify({ error: "team_member_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member, error: memErr } = await supabase
      .from("team_members")
      .select("id, email, profile_id")
      .eq("id", team_member_id)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!member) {
      return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve auth user id (via profile_id or email)
    let authUserId: string | null = member.profile_id ?? null;
    if (!authUserId && member.email) {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u: any) => u.email?.toLowerCase() === member.email.toLowerCase());
      authUserId = found?.id ?? null;
    }

    // Delete team_members row first (cascades to dependent fk's where defined)
    const { error: delMemErr } = await supabase
      .from("team_members")
      .delete()
      .eq("id", team_member_id);
    if (delMemErr) throw delMemErr;

    // Delete auth user (will cascade to profiles & user_roles via fk on delete cascade)
    if (authUserId) {
      await supabase.auth.admin.deleteUser(authUserId);
    }

    return new Response(JSON.stringify({ success: true, auth_deleted: !!authUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("delete-member error", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro inesperado" }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});