import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find active clients whose end_of_cycle is within 30 days from now
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const today = new Date().toISOString().split("T")[0];
    const cutoff = thirtyDaysFromNow.toISOString().split("T")[0];

    // Get clients that are "ativo" and have end_of_cycle within 30 days
    const { data: clients, error: fetchError } = await supabase
      .from("clients")
      .select("id, full_name, end_of_cycle, status")
      .eq("status", "ativo")
      .not("end_of_cycle", "is", null)
      .lte("end_of_cycle", cutoff)
      .gte("end_of_cycle", today);

    if (fetchError) throw fetchError;

    let updated = 0;
    for (const client of clients || []) {
      const { error } = await supabase
        .from("clients")
        .update({ status: "altura_renovacao" })
        .eq("id", client.id);
      if (!error) updated++;
    }

    return new Response(
      JSON.stringify({ success: true, updated, checked: clients?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
