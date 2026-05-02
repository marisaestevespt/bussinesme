import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { MessageCircle, LifeBuoy, BookOpen, Bug, Lightbulb } from 'lucide-react';

const SUPPORT_WHATSAPP = '351913544284'; // formato internacional para wa.me

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Como crio um novo cliente?',
    a: 'Vai a Clientes (no menu Departamentos) e clica em "Novo cliente". Preenche os dados essenciais e guarda. O cliente fica logo disponível para associar a projetos, reuniões e produtos.',
  },
  {
    q: 'Como adiciono um membro à minha equipa?',
    a: 'Em Recursos Humanos > Equipa, clica em "Adicionar membro". Define o tipo (interno, prestador, contabilista) e atribui um papel. Se quiseres dar acesso à plataforma, envia o convite por email a partir do detalhe do membro.',
  },
  {
    q: 'Como controlo as permissões dos membros?',
    a: 'Em Definições > Papéis e Permissões, podes criar papéis personalizados e marcar exatamente que módulos cada papel pode ver. Depois, em Recursos Humanos, atribuis o papel a cada membro.',
  },
  {
    q: 'O que é o Portal do Cliente?',
    a: 'Cada cliente pode ter um portal próprio com link único. Aí o cliente vê os projetos, marca reuniões, faz upload de ficheiros e responde a perguntas iniciais. Cria-o no detalhe do cliente, na secção "Portal".',
  },
  {
    q: 'Como funcionam as Rotinas?',
    a: 'Rotinas são tarefas recorrentes (semanal, mensal, anual) que o sistema cria automaticamente todos os dias para o responsável. Geres tudo em Tarefas > Rotinas.',
  },
  {
    q: 'Como personalizo as cores e o logo?',
    a: 'Em Definições > Identidade. Podes mudar o nome do negócio, logo e cores principais — tudo se reflete imediatamente em toda a aplicação.',
  },
  {
    q: 'Como exporto os meus dados?',
    a: 'A maioria das listas tem botão de exportar para CSV ou Excel no canto superior direito. Para exportações específicas, fala connosco no WhatsApp.',
  },
  {
    q: 'Os dados estão seguros?',
    a: 'Sim. Cada negócio tem isolamento total dos dados, com regras de acesso ao nível da base de dados. Apenas membros do teu negócio com permissão podem ver a tua informação.',
  },
];

export default function AjudaPage() {
  const waText = encodeURIComponent('Olá! Preciso de ajuda com a plataforma Lyrata:');
  const waUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${waText}`;

  const reportText = encodeURIComponent('Olá! Quero reportar um problema na plataforma Lyrata:\n\nO que aconteceu:\n\nOnde aconteceu (página/módulo):\n\nPassos para reproduzir:\n');
  const reportUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${reportText}`;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Ajuda & Suporte
          </h1>
          <p className="text-sm text-muted-foreground">
            Encontra respostas rápidas ou fala diretamente connosco.
          </p>
        </header>

        {/* Contact cards */}
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="hq-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4 text-success" />
                Falar com o suporte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tens uma dúvida ou precisas de ajuda? Manda-nos uma mensagem direta.
              </p>
              <Button asChild className="w-full" size="sm">
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Abrir WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hq-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bug className="h-4 w-4 text-destructive" />
                Reportar um problema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Encontraste um bug ou comportamento estranho? Avisa-nos para corrigirmos.
              </p>
              <Button asChild variant="outline" className="w-full" size="sm">
                <a href={reportUrl} target="_blank" rel="noopener noreferrer">
                  <Bug className="mr-2 h-4 w-4" />
                  Reportar via WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQs */}
        <Card className="hq-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" />
              Perguntas Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-sm">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Tip */}
        <Card className="hq-card border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Dica</p>
              <p className="text-sm text-muted-foreground">
                Se a tua dúvida não está aqui, não hesites em abrir o WhatsApp.
                Estamos a melhorar a plataforma todos os dias com base no teu feedback.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}