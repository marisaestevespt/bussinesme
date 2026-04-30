import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { supabase } from '@/integrations/supabase/client';
import { MentionList, MentionItem } from './MentionList';

let cachedProfiles: MentionItem[] | null = null;

async function loadProfiles(): Promise<MentionItem[]> {
  if (cachedProfiles) return cachedProfiles;
  const { data } = await supabase.from('profiles').select('id, full_name');
  cachedProfiles = (data || []).map((p: any) => ({ id: p.id, label: p.full_name || 'Membro' }));
  return cachedProfiles;
}

export const mentionSuggestion = {
  items: async ({ query }: { query: string }) => {
    const profiles = await loadProfiles();
    return profiles
      .filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
  },

  render: () => {
    let component: ReactRenderer | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, { props, editor: props.editor });
        if (!props.clientRect) return;
        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },
      onUpdate: (props: any) => {
        component?.updateProps(props);
        if (!props.clientRect) return;
        popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect });
      },
      onKeyDown: (props: any) => {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }
        return (component?.ref as any)?.onKeyDown(props);
      },
      onExit: () => {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};