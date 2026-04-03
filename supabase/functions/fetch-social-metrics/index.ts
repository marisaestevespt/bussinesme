import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const GRAPH_API = "https://graph.facebook.com/v22.0";
const YT_API = "https://www.googleapis.com/youtube/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sem autorização");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Sessão inválida");

    const body = await req.json().catch(() => ({}));
    const channelId = body.channel_id; // optional: sync a single channel

    // Fetch tokens
    let query = supabase
      .from("channel_social_tokens")
      .select("*, marketing_channels(id, name)")
      .neq("access_token", "");

    if (channelId) query = query.eq("channel_id", channelId);

    const { data: tokens, error: tokErr } = await query;
    if (tokErr) throw new Error(tokErr.message);
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "Sem tokens configurados" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const results: any[] = [];

    for (const token of tokens) {
      const platform = (token.platform || "").toLowerCase();
      const channelName = (token.marketing_channels as any)?.name?.toLowerCase() || "";
      const accessToken = token.access_token;
      const meta = token.token_metadata || {};

      try {
        let metrics: Record<string, any> = {};

        if (platform === "instagram" || channelName === "instagram") {
          metrics = await fetchInstagramMetrics(accessToken, meta);
        } else if (platform === "youtube" || channelName === "youtube") {
          metrics = await fetchYouTubeMetrics(accessToken, meta);
        } else if (platform === "facebook" || channelName === "facebook") {
          metrics = await fetchFacebookMetrics(accessToken, meta);
        } else {
          results.push({ channel: channelName, status: "skipped", reason: "Plataforma não suportada" });
          continue;
        }

        // Upsert into channel_monthly_metrics
        const { error: upsertErr } = await supabase
          .from("channel_monthly_metrics")
          .upsert(
            { channel_id: token.channel_id, month, year, ...metrics },
            { onConflict: "channel_id,month,year" }
          );

        if (upsertErr) throw upsertErr;

        // Update last_synced_at
        await supabase
          .from("channel_social_tokens")
          .update({ last_synced_at: now.toISOString() })
          .eq("id", token.id);

        results.push({ channel: channelName, status: "ok", metrics });
      } catch (e: any) {
        results.push({ channel: channelName, status: "error", error: e.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Instagram (Meta Graph API) ────────────────────────────────────
async function fetchInstagramMetrics(token: string, meta: any) {
  const igUserId = meta.ig_user_id || meta.page_id || "me";

  // Account info (followers)
  const userRes = await fetch(
    `${GRAPH_API}/${igUserId}?fields=followers_count,media_count&access_token=${token}`
  );
  const userData = await userRes.json();
  if (userData.error) throw new Error(`Instagram API: ${userData.error.message}`);

  const followers = userData.followers_count || 0;

  // Account insights (28 days)
  const now = Math.floor(Date.now() / 1000);
  const since = now - 28 * 86400;
  const insightsRes = await fetch(
    `${GRAPH_API}/${igUserId}/insights?metric=impressions,reach,profile_views&period=day&since=${since}&until=${now}&access_token=${token}`
  );
  const insightsData = await insightsRes.json();

  let totalImpressions = 0, totalReach = 0, totalProfileVisits = 0;

  if (insightsData.data) {
    for (const metric of insightsData.data) {
      const sum = (metric.values || []).reduce((a: number, v: any) => a + (v.value || 0), 0);
      if (metric.name === "impressions") totalImpressions = sum;
      if (metric.name === "reach") totalReach = sum;
      if (metric.name === "profile_views") totalProfileVisits = sum;
    }
  }

  // Calculate engagement from recent media
  const mediaRes = await fetch(
    `${GRAPH_API}/${igUserId}/media?fields=like_count,comments_count,timestamp&limit=25&access_token=${token}`
  );
  const mediaData = await mediaRes.json();

  let totalLikes = 0, totalComments = 0, mediaCount = 0;
  if (mediaData.data) {
    for (const m of mediaData.data) {
      totalLikes += m.like_count || 0;
      totalComments += m.comments_count || 0;
      mediaCount++;
    }
  }

  const avgLikes = mediaCount > 0 ? Math.round(totalLikes / mediaCount) : 0;
  const avgComments = mediaCount > 0 ? Math.round(totalComments / mediaCount) : 0;
  const engagementRate = followers > 0 && mediaCount > 0
    ? Math.round(((totalLikes + totalComments) / mediaCount / followers) * 10000) / 100
    : 0;

  return {
    followers,
    ig_total_impressions: totalImpressions,
    ig_accounts_reached: totalReach,
    ig_profile_visits: totalProfileVisits,
    ig_avg_likes: avgLikes,
    ig_avg_comments: avgComments,
    ig_engagement_rate: engagementRate,
  };
}

// ─── YouTube (Data API v3) ─────────────────────────────────────────
async function fetchYouTubeMetrics(apiKey: string, meta: any) {
  const channelId = meta.channel_id;
  if (!channelId) throw new Error("channel_id não configurado nos metadados");

  const res = await fetch(
    `${YT_API}/channels?part=statistics&id=${channelId}&key=${apiKey}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`YouTube API: ${data.error.message}`);

  const stats = data.items?.[0]?.statistics;
  if (!stats) throw new Error("Canal YouTube não encontrado");

  return {
    followers: parseInt(stats.subscriberCount || "0"),
    yt_total_views: parseInt(stats.viewCount || "0"),
    yt_new_subscribers: null, // requires Analytics API for period data
  };
}

// ─── Facebook (Graph API) ──────────────────────────────────────────
async function fetchFacebookMetrics(token: string, meta: any) {
  const pageId = meta.page_id;
  if (!pageId) throw new Error("page_id não configurado nos metadados");

  const res = await fetch(
    `${GRAPH_API}/${pageId}?fields=followers_count,fan_count&access_token=${token}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API: ${data.error.message}`);

  return {
    followers: data.followers_count || data.fan_count || 0,
  };
}
