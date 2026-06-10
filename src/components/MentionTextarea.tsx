import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  singleLine?: boolean;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  onKeyDown,
  singleLine = false,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const { getPhotoUrl } = useTeamPhotos();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-mentions'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url');
      return (data || []) as Profile[];
    },
    staleTime: 60000,
  });

  const filtered = mentionQuery !== null
    ? profiles.filter(p =>
        p.full_name?.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  const updateDropdownPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Create a mirror div to measure caret position
    const mirror = document.createElement('div');
    const computed = window.getComputedStyle(textarea);
    const properties = [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingTop', 'paddingLeft', 'paddingRight', 'borderTopWidth', 'borderLeftWidth',
      'boxSizing', 'wordWrap', 'whiteSpace', 'overflowWrap',
    ] as const;
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.width = `${textarea.clientWidth}px`;
    properties.forEach(prop => {
      mirror.style[prop as any] = computed[prop as any];
    });

    const textBefore = value.substring(0, textarea.selectionStart);
    mirror.textContent = textBefore;
    const marker = document.createElement('span');
    marker.textContent = '|';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const rect = textarea.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    setDropdownPos({
      top: markerRect.top - mirrorRect.top + parseInt(computed.lineHeight || '20') + 4,
      left: markerRect.left - mirrorRect.left,
    });

    document.body.removeChild(mirror);
  }, [value]);

  const handleInput = (newValue: string) => {
    onChange(newValue);

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Use setTimeout to get updated selectionStart after React re-render
    setTimeout(() => {
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = newValue.substring(0, cursorPos);

      // Find the last @ that could be a mention trigger
      const lastAt = textBeforeCursor.lastIndexOf('@');
      if (lastAt === -1) {
        setMentionQuery(null);
        return;
      }

      // Check that @ is at start or preceded by a space/newline
      const charBefore = lastAt > 0 ? textBeforeCursor[lastAt - 1] : ' ';
      if (charBefore !== ' ' && charBefore !== '\n' && lastAt !== 0) {
        setMentionQuery(null);
        return;
      }

      const query = textBeforeCursor.substring(lastAt + 1);
      // No spaces allowed in the query (means mention was "completed")
      if (query.includes(' ') && query.length > 20) {
        setMentionQuery(null);
        return;
      }

      setMentionQuery(query);
      setMentionStart(lastAt);
      setSelectedIndex(0);
      updateDropdownPosition();
    }, 0);
  };

  const selectMention = (profile: Profile) => {
    const name = profile.full_name || 'Membro';
    const before = value.substring(0, mentionStart);
    const textarea = textareaRef.current;
    const cursorPos = textarea?.selectionStart || mentionStart + (mentionQuery?.length || 0) + 1;
    const after = value.substring(cursorPos);
    const newValue = `${before}@${name} ${after}`;
    onChange(newValue);
    setMentionQuery(null);

    // Set cursor after the mention
    setTimeout(() => {
      if (textarea) {
        const pos = mentionStart + name.length + 2; // @ + name + space
        textarea.selectionStart = pos;
        textarea.selectionEnd = pos;
        textarea.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(filtered[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={singleLine ? 1 : rows}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none",
          singleLine && "h-9 py-1.5",
          className,
        )}
      />

      {mentionQuery !== null && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-56 rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ top: dropdownPos.top, left: Math.min(dropdownPos.left, 200) }}
        >
          {filtered.map((p, i) => (
            <button
              key={p.id}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
              )}
              onMouseDown={e => { e.preventDefault(); selectMention(p); }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={getPhotoUrl(p)} />
                <AvatarFallback className="text-[9px]">{getInitials(p.full_name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{p.full_name || 'Membro'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders text with @mentions highlighted */
export function RichText({ text, className }: { text: string; className?: string }) {
  const { data: names = [] } = useQuery({
    queryKey: ['profiles-mention-names'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('full_name');
      return (data || [])
        .map((p: any) => p.full_name as string | null)
        .filter((n): n is string => !!n)
        .sort((a, b) => b.length - a.length); // longest first for greedy match
    },
    staleTime: 60000,
  });

  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    if (text[i] === '@') {
      const rest = text.slice(i + 1);
      const match = names.find((n) => rest.startsWith(n));
      if (match) {
        nodes.push(
          <span key={key++} className="font-medium text-primary">
            @{match}
          </span>
        );
        i += 1 + match.length;
        continue;
      }
    }
    // accumulate plain text until next @
    const nextAt = text.indexOf('@', i + 1);
    const end = nextAt === -1 ? text.length : nextAt;
    nodes.push(<span key={key++}>{text.slice(i, end)}</span>);
    i = end;
  }

  return <span className={className}>{nodes}</span>;
}
