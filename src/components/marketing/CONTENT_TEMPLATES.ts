export interface ContentTemplate {
  key: string;
  label: string;
  emoji: string;
  description: string;
  defaultTitle: string;
  defaultChannel?: string;
  defaultContentType?: string;
  defaultFormat?: string;
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
  // Instagram
  {
    key: 'ig_post',
    label: 'Instagram — Post',
    emoji: '📸',
    description: 'Post estático no feed (imagem única)',
    defaultTitle: 'Post Instagram',
    defaultChannel: 'Instagram',
    defaultContentType: 'post',
    defaultFormat: 'estatico',
    defaultCopy: 'Legenda:\n\nHashtags:\n\nCTA:',
  },
  {
    key: 'ig_carrossel',
    label: 'Instagram — Carrossel',
    emoji: '🖼️',
    description: 'Carrossel de slides no feed',
    defaultTitle: 'Carrossel Instagram',
    defaultChannel: 'Instagram',
    defaultContentType: 'post',
    defaultFormat: 'carrossel',
    defaultCopy: 'Slide 1 (capa/hook):\nSlide 2:\nSlide 3:\nSlide 4:\nSlide final (CTA):\n\nLegenda:\n\nHashtags:',
  },
  {
    key: 'ig_reel',
    label: 'Instagram — Reel',
    emoji: '🎬',
    description: 'Vídeo curto vertical',
    defaultTitle: 'Reel Instagram',
    defaultChannel: 'Instagram',
    defaultContentType: 'reel',
    defaultFormat: 'reels',
    defaultCopy: 'Hook (3 primeiros segundos):\n\nGuião:\n\nLegenda:\n\nMúsica/áudio:',
  },
  {
    key: 'ig_story',
    label: 'Instagram — Story',
    emoji: '⚡',
    description: 'Sequência de stories efémeros',
    defaultTitle: 'Story Instagram',
    defaultChannel: 'Instagram',
    defaultContentType: 'story',
    defaultFormat: 'stories',
    defaultCopy: 'Story 1:\nStory 2:\nStory 3:\n\nStickers/interações:',
  },
  // YouTube
  {
    key: 'yt_video',
    label: 'YouTube — Vídeo',
    emoji: '▶️',
    description: 'Vídeo longo horizontal',
    defaultTitle: 'Vídeo YouTube',
    defaultChannel: 'Youtube',
    defaultContentType: 'video',
    defaultFormat: 'longo_youtube',
    defaultCopy: 'Título:\n\nHook (15s iniciais):\n\nGuião / estrutura:\n\nDescrição:\n\nThumbnail:',
  },
  {
    key: 'yt_short',
    label: 'YouTube — Short',
    emoji: '📱',
    description: 'Vídeo curto vertical',
    defaultTitle: 'Short YouTube',
    defaultChannel: 'Youtube',
    defaultContentType: 'short',
    defaultFormat: 'short_tiktok',
    defaultCopy: 'Hook (3s):\n\nGuião:\n\nTítulo / descrição:',
  },
  // TikTok
  {
    key: 'tt_video',
    label: 'TikTok — Vídeo',
    emoji: '🎵',
    description: 'Vídeo curto vertical com áudio',
    defaultTitle: 'TikTok',
    defaultChannel: 'TikTok',
    defaultContentType: 'video',
    defaultFormat: 'short_tiktok',
    defaultCopy: 'Hook (3s):\n\nGuião:\n\nLegenda:\n\nÁudio/som:\n\nHashtags:',
  },
  // LinkedIn
  {
    key: 'li_post',
    label: 'LinkedIn — Post',
    emoji: '💼',
    description: 'Post de texto / opinião profissional',
    defaultTitle: 'Post LinkedIn',
    defaultChannel: 'LinkedIn',
    defaultContentType: 'post',
    defaultFormat: 'post_linkedin',
    defaultCopy: 'Hook (1ª linha):\n\nDesenvolvimento:\n\nLição/insight:\n\nCTA / pergunta:',
  },
  {
    key: 'li_artigo',
    label: 'LinkedIn — Artigo',
    emoji: '📰',
    description: 'Artigo longo no LinkedIn',
    defaultTitle: 'Artigo LinkedIn',
    defaultChannel: 'LinkedIn',
    defaultContentType: 'artigo',
    defaultFormat: 'post_linkedin',
    defaultCopy: 'Título:\n\nIntrodução:\n\nSecções:\n\nConclusão / CTA:',
  },
  // Pinterest
  {
    key: 'pin_pin',
    label: 'Pinterest — Pin',
    emoji: '📌',
    description: 'Pin estático com imagem vertical',
    defaultTitle: 'Pin Pinterest',
    defaultChannel: 'Pinterest',
    defaultContentType: 'pin',
    defaultFormat: 'pin',
    defaultCopy: 'Título do pin:\n\nDescrição (SEO):\n\nLink de destino:',
  },
  // Email / Newsletter
  {
    key: 'email_news',
    label: 'Email — Newsletter',
    emoji: '✉️',
    description: 'Newsletter regular para a base',
    defaultTitle: 'Newsletter',
    defaultChannel: 'Email Marketing',
    defaultContentType: 'email',
    defaultFormat: 'email',
    defaultCopy: 'Assunto:\n\nPré-header:\n\nIntro:\n\nConteúdo principal:\n\nCTA:',
  },
  {
    key: 'email_campanha',
    label: 'Email — Campanha',
    emoji: '📧',
    description: 'Email de campanha pontual',
    defaultTitle: 'Email de Campanha',
    defaultChannel: 'Email Marketing',
    defaultContentType: 'email',
    defaultFormat: 'email',
    defaultCopy: 'Assunto:\n\nPré-header:\n\nMensagem:\n\nCTA principal:\n\nP.S.:',
  },
  // Blog / Website
  {
    key: 'blog_post',
    label: 'Blog — Artigo',
    emoji: '📝',
    description: 'Artigo de blog para SEO',
    defaultTitle: 'Artigo de Blog',
    defaultChannel: 'Blog',
    defaultContentType: 'artigo',
    defaultFormat: 'outro',
    defaultCopy: 'Título (H1):\n\nMeta descrição:\n\nIntrodução:\n\nSubtópicos (H2):\n\nConclusão / CTA:',
  },
  // Podcast
  {
    key: 'pod_episodio',
    label: 'Podcast — Episódio',
    emoji: '🎙️',
    description: 'Episódio de podcast em áudio',
    defaultTitle: 'Episódio de Podcast',
    defaultChannel: 'Podcast',
    defaultContentType: 'podcast',
    defaultFormat: 'outro',
    defaultCopy: 'Título do episódio:\n\nGuião / tópicos:\n\nConvidado(s):\n\nDescrição (show notes):',
  },
];