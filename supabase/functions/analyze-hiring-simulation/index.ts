import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { getCorsHeaders } from "../_shared/cors.ts";
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { simulation } = await req.json();

    const prompt = `Analisa esta simulação de contratação de uma empresa portuguesa e dá recomendações estratégicas. Responde em português de Portugal, de forma concisa e prática. Usa bullet points.

DADOS DA SIMULAÇÃO:
- Equipa atual: ${simulation.currentTeamSize} membros
- Capacidade atual: ${simulation.currentCapacity}h/mês
- Ocupação atual: ${simulation.currentUsage}%
- Novas contratações simuladas: ${simulation.phantomCount}

DETALHES DAS CONTRATAÇÕES:
${simulation.phantoms.map((p: any) => `• ${p.name} — ${p.type}, ${p.department}, ${p.weeklyHours}h/sem, ${p.clientPct}% cliente, custo mensal: ${p.totalCostMonth}€${p.durationMonths ? `, duração: ${p.durationMonths} meses` : ''}, início: ${p.startDate}${p.delegatedTasks?.length ? `\n  Tarefas a delegar: ${p.delegatedTasks.join('; ')}` : ''}`).join('\n')}

IMPACTO:
- Nova capacidade: ${simulation.newCapacity}h/mês
- Nova ocupação: ${simulation.newUsage}%
- Custo mensal adicional: ${simulation.totalMonthlyCost}€
- Custo anual adicional: ${simulation.totalAnnualCost}€
- Capacidade ganha: +${simulation.addedCapacity}h/mês
- Horas cliente ganhas: +${simulation.addedClientH}h/mês

Analisa os seguintes pontos:
1. **Viabilidade**: Esta contratação faz sentido dado o nível de ocupação atual?
2. **Timing**: A data de início é adequada ou devia ser antecipada/adiada?
3. **Custo-benefício**: O custo é proporcional ao ganho de capacidade? Vale a pena?
4. **Tipo de contrato**: O tipo escolhido (colaborador vs prestador) é o mais adequado para cada caso?
5. **Delegação de tarefas**: As tarefas selecionadas para delegar fazem sentido? Há alguma que devesse ser mantida internamente? O volume é adequado para a capacidade da nova pessoa?
6. **Riscos**: Que riscos existem nesta decisão?
7. **Recomendação final**: Resumo com decisão clara (✅ Avançar / ⚠️ Ponderar / ❌ Não recomendado)

Sê direto e prático. Foca em ajudar o owner a tomar uma decisão informada.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "És um consultor de gestão e recursos humanos especializado em PMEs portuguesas. Dás análises concisas, práticas e estratégicas sobre decisões de contratação." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API error: ${err}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Não foi possível gerar análise.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
