import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useState } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import { mentionSuggestion } from './rich-editor/mentionSuggestion';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, Palette, Highlighter, Undo, Redo,
  ListChecks, Quote,
  ImagePlus, Type, Minus,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const COLORS = [
  // Tons pastel suaves para texto
  '#4b5563', '#9ca3af', '#c8a2a2', '#e4b48c', '#e6cf8a',
  '#a8c8a1', '#9bb8d9', '#b6a8d4', '#dba8c1', '#a89b8c',
  '#ffffff',
];

const normalizeEditorContent = (html?: string) => {
  const value = html || '';
  return value === '<p></p>' ? '' : value;
};

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  enableMentions?: boolean;
  minHeight?: number;
  enableImages?: boolean;
  /** Quando true, a toolbar arranca colapsada e só aparece ao focar o editor ou clicar no botão "Aa". */
  collapsibleToolbar?: boolean;
}

export function RichTextEditor({ content, onChange, editable = true, placeholder, enableMentions = false, minHeight = 200, enableImages = false, collapsibleToolbar = false }: RichTextEditorProps) {
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const showToolbar = !collapsibleToolbar || focused || pinned;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Underline já é incluído por StarterKit em versões recentes;
        // desativamos aqui para evitar duplicação com a extensão dedicada abaixo.
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder || '' }),
      ...(enableImages ? [Image.configure({ HTMLAttributes: { class: 'rounded-lg max-w-full my-3' } })] : []),
      ...(enableMentions
        ? [Mention.configure({
            HTMLAttributes: { class: 'mention' },
            suggestion: mentionSuggestion,
          })]
        : []),
    ],
    content,
    editable,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    // Não sincronizar enquanto o utilizador está a editar — caso contrário
    // o setContent reseta a seleção/marcas activas (ex.: negrito acabado de ativar)
    // e obriga a clicar 2x para aplicar formatação.
    if (editor.isFocused) return;
    if (normalizeEditorContent(editor.getHTML()) !== normalizeEditorContent(content)) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  const ToolBtn = ({ active, onClick, children, title }: any) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', active && 'bg-muted')}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div className="border rounded-md overflow-hidden relative group">
      {editable && collapsibleToolbar && !showToolbar && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setPinned(true); }}
          className="absolute top-1.5 right-1.5 z-10 h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
          title="Mostrar formatação"
        >
          <Type className="h-3.5 w-3.5" />
        </button>
      )}
      {editable && showToolbar && (
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
          <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
            <Bold className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
            <Italic className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado">
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Riscado">
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1">
            <Heading1 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2">
            <Heading2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3">
            <Heading3 className="h-3.5 w-3.5" />
          </ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
            <List className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista Numerada">
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
            <ListChecks className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">
            <Quote className="h-3.5 w-3.5" />
          </ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinhar à esquerda">
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrar">
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinhar à direita">
            <AlignRight className="h-3.5 w-3.5" />
          </ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Cor do texto">
                <Palette className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex gap-1 flex-wrap max-w-[180px]">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className="h-6 w-6 rounded border border-border"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                  />
                ))}
                <button
                  type="button"
                  className="h-6 w-6 rounded border border-border text-[10px]"
                  onClick={() => editor.chain().focus().unsetColor().run()}
                >
                  ✕
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Destaque">
                <Highlighter className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex gap-1 flex-wrap max-w-[180px]">
                {['#fef9c3', '#dcfce7', '#dbeafe', '#fee2e2', '#f3e8ff', '#ffedd5', '#fce7f3', '#cffafe'].map(color => (
                  <button
                    key={color}
                    type="button"
                    className="h-6 w-6 rounded border border-border"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                  />
                ))}
                <button
                  type="button"
                  className="h-6 w-6 rounded border border-border text-[10px]"
                  onClick={() => editor.chain().focus().unsetHighlight().run()}
                >
                  ✕
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
            <Undo className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer">
            <Redo className="h-3.5 w-3.5" />
          </ToolBtn>
          {enableImages && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolBtn
                title="Inserir imagem (URL)"
                onClick={() => {
                  const url = window.prompt('URL da imagem:');
                  if (url) editor.chain().focus().setImage({ src: url }).run();
                }}
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </ToolBtn>
            </>
          )}
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:h-auto [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_ul[data-type=taskList]]:list-none [&_.ProseMirror_ul[data-type=taskList]_li]:flex [&_.ProseMirror_ul[data-type=taskList]_li]:gap-2 [&_.ProseMirror_ul[data-type=taskList]_li>label]:mt-1 [&_.mention]:bg-primary/10 [&_.mention]:text-primary [&_.mention]:rounded [&_.mention]:px-1 [&_.mention]:py-0.5"
        style={{ ['--rte-min-h' as any]: `${minHeight}px` } as React.CSSProperties}
      />
    </div>
  );
}
