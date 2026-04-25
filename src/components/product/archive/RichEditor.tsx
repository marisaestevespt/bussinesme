import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, ListChecks, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, Palette, Highlighter, Undo, Redo,
  Image as ImageIcon, Link as LinkIcon, Table as TableIcon, Code, Quote,
} from 'lucide-react';

const COLORS = [
  '#4b5563', '#9ca3af', '#c8a2a2', '#e4b48c', '#e6cf8a',
  '#a8c8a1', '#9bb8d9', '#b6a8d4', '#dba8c1', '#a89b8c', '#ffffff',
];

interface Props {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  uploadFolder: string; // e.g. `brainstorming/{productId}`
  variant?: 'full' | 'simple';
}

export function RichEditor({ content, onChange, editable = true, uploadFolder, variant = 'full' }: Props) {
  const isFull = variant === 'full';

  const extensions = [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
    Image.configure({ HTMLAttributes: { class: 'rounded-md max-w-full h-auto my-2' } }),
  ];

  if (isFull) {
    extensions.push(
      Table.configure({ resizable: true }) as never,
      TableRow as never,
      TableHeader as never,
      TableCell as never,
      TaskList as never,
      TaskItem.configure({ nested: true }) as never,
    );
  }

  const editor = useEditor({
    extensions,
    content,
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const ToolBtn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) => (
    <Button type="button" variant="ghost" size="icon" className={cn('h-7 w-7', active && 'bg-muted')} onClick={onClick} title={title}>
      {children}
    </Button>
  );

  const handleImage = async (file: File) => {
    const path = `${uploadFolder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('product-files').upload(path, file);
    if (error) { toast.error('Erro ao enviar imagem'); return; }
    const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
    editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
  };

  const insertLink = () => {
    const url = window.prompt('URL do link:');
    if (!url) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="border rounded-md bg-background">
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b sticky top-0 bg-background z-10">
          <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito"><Bold className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico"><Italic className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado"><UnderlineIcon className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Riscado"><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1"><Heading1 className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2"><Heading2 className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3"><Heading3 className="h-3.5 w-3.5" /></ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista"><List className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
          {isFull && (
            <ToolBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist"><ListChecks className="h-3.5 w-3.5" /></ToolBtn>
          )}
          <ToolBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quote className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Código"><Code className="h-3.5 w-3.5" /></ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Esquerda"><AlignLeft className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centro"><AlignCenter className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Direita"><AlignRight className="h-3.5 w-3.5" /></ToolBtn>

          <div className="w-px h-5 bg-border mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Cor"><Palette className="h-3.5 w-3.5" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-6 gap-1">
                {COLORS.map(c => (
                  <button key={c} onClick={() => editor.chain().focus().setColor(c).run()} className="w-6 h-6 rounded border" style={{ backgroundColor: c }} />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Destaque"><Highlighter className="h-3.5 w-3.5" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-6 gap-1">
                {COLORS.map(c => (
                  <button key={c} onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()} className="w-6 h-6 rounded border" style={{ backgroundColor: c }} />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolBtn onClick={insertLink} title="Inserir link" active={editor.isActive('link')}><LinkIcon className="h-3.5 w-3.5" /></ToolBtn>

          <label className="cursor-pointer">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Inserir imagem" asChild>
              <span><ImageIcon className="h-3.5 w-3.5" /></span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = ''; }} />
          </label>

          {isFull && (
            <ToolBtn
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              title="Inserir tabela"
            ><TableIcon className="h-3.5 w-3.5" /></ToolBtn>
          )}

          <div className="ml-auto flex items-center gap-0.5">
            <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Anular"><Undo className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo className="h-3.5 w-3.5" /></ToolBtn>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
