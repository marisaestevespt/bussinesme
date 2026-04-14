import { Card, CardContent } from '@/components/ui/card';
import { Section, AccentCard } from './shared';

const BRANCHES = [
  {
    color: 'coral' as const,
    title: 'O que ela pensa (monólogo interno)',
    items: [
      'Tenho que estar em cima de tudo para funcionar',
      'Não posso delegar porque ninguém faz como eu',
      'Se eu parar, o negócio para',
      'Já tentei e não correu bem',
      'Não tenho tempo para organizar — tenho trabalho para fazer',
      'Quando crescer mais, aí organizo',
    ],
  },
  {
    color: 'red' as const,
    title: 'O que ela sente',
    items: [
      'Exaustão pelo retrabalho constante',
      'Ansiedade de que tudo depende dela',
      'Frustração de não conseguir implementar o que sabe',
      'Vergonha de "ainda não ter processos"',
      'Medo de perder o gosto pelo que faz',
      'Alívio quando encontra alguém que percebe o problema',
    ],
  },
  {
    color: 'blue' as const,
    title: 'O que ela faz (comportamento atual)',
    items: [
      'Trabalha de noite para compensar o dia',
      'Acumula ferramentas que não comunicam entre si',
      'Delega e depois microverifica tudo',
      'Muda de foco quando uma tarefa fica difícil',
      'Consome conteúdo de organização mas não aplica',
      'Adia o "organizar" para quando tiver tempo',
    ],
  },
  {
    color: 'teal' as const,
    title: 'O que ela quer (desejos centrais)',
    items: [
      'Negócio que funcione sem ela estar presente',
      'Equipa que não precisa de perguntar tudo',
      'Visão clara do que se passa sem fazer contas',
      'Crescer sem sacrificar a vida pessoal',
      'Sentir-se no controlo sem microgerir',
      'Saber que pode aceitar mais clientes com confiança',
    ],
  },
];

export function SectionMapaMental() {
  return (
    <Section id="mapa-mental" num="03" label="Mapa mental" title="Como ela pensa e o que sente">
      <Card className="mb-4">
        <CardContent className="p-4 text-center">
          <p className="text-sm font-semibold text-foreground">A prestadora de serviços que quer crescer sem caos</p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BRANCHES.map(b => (
          <AccentCard key={b.title} color={b.color} title={b.title}>
            <ul className="text-xs text-foreground space-y-1.5 list-disc pl-4">
              {b.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </AccentCard>
        ))}
      </div>
    </Section>
  );
}
