export interface ContentTemplate {
  key: string;
  label: string;
  emoji: string;
  description: string;
  defaultTitle: string;
  defaultContentType?: string;
  defaultFormat?: string;
  defaultFunnelStage?: string;
  defaultObjective?: string;
  defaultCopy?: string;
}

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    key: 'blank',
    label: 'Em branco',
    emoji: '📄',
    description: 'Começa do zero, sem pré-definições',
    defaultTitle: 'Novo Conteúdo',
  },
  {
    key: 'post_educativo',
    label: 'Post Educativo',
    emoji: '🎓',
    description: 'Topo de funil — ensinar e atrair audiência',
    defaultTitle: 'Post Educativo',
    defaultContentType: 'post',
    defaultFormat: 'carrossel',
    defaultFunnelStage: 'topo',
    defaultObjective: 'awareness',
    defaultCopy: 'Hook (1ª linha):\n\nProblema/contexto:\n\n3 pontos-chave:\n1.\n2.\n3.\n\nCTA:',
  },
  {
    key: 'reel_viral',
    label: 'Reel / Vídeo curto',
    emoji: '🎬',
    description: 'Vídeo curto para alcance e descoberta',
    defaultTitle: 'Reel',
    defaultContentType: 'reel',
    defaultFormat: 'video',
    defaultFunnelStage: 'topo',
    defaultObjective: 'awareness',
    defaultCopy: 'Hook (3 primeiros segundos):\n\nDesenvolvimento:\n\nPayoff/CTA:\n\nLegenda:',
  },
  {
    key: 'caso_sucesso',
    label: 'Caso de Sucesso',
    emoji: '🏆',
    description: 'Meio de funil — prova social e resultados',
    defaultTitle: 'Caso de Sucesso',
    defaultContentType: 'post',
    defaultFormat: 'carrossel',
    defaultFunnelStage: 'meio',
    defaultObjective: 'consideracao',
    defaultCopy: 'Cliente / contexto inicial:\n\nDesafio:\n\nSolução aplicada:\n\nResultados (números):\n\nTestemunho:',
  },
  {
    key: 'venda_oferta',
    label: 'Post de Venda',
    emoji: '💰',
    description: 'Fundo de funil — apresentação de oferta',
    defaultTitle: 'Oferta',
    defaultContentType: 'post',
    defaultFormat: 'imagem',
    defaultFunnelStage: 'fundo',
    defaultObjective: 'conversao',
    defaultCopy: 'Para quem é:\n\nO que vais ter:\n\nBenefícios concretos:\n\nPreço / condições:\n\nCTA + link:',
  },
  {
    key: 'newsletter',
    label: 'Newsletter',
    emoji: '✉️',
    description: 'Email para a base — nutrição e relação',
    defaultTitle: 'Newsletter',
    defaultContentType: 'email',
    defaultFormat: 'newsletter',
    defaultFunnelStage: 'meio',
    defaultObjective: 'consideracao',
    defaultCopy: 'Assunto:\n\nPré-header:\n\nIntro pessoal:\n\nConteúdo principal:\n\nCTA:',
  },
  {
    key: 'story',
    label: 'Story / Bastidores',
    emoji: '📸',
    description: 'Conteúdo efémero — proximidade e relação',
    defaultTitle: 'Story',
    defaultContentType: 'story',
    defaultFormat: 'imagem',
    defaultFunnelStage: 'meio',
    defaultObjective: 'engagement',
    defaultCopy: 'Sequência de stories:\n1.\n2.\n3.\n\nStickers/interações:',
  },
];