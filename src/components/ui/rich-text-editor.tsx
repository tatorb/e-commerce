'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { IconButton } from '@/components/ui/section-card';
import { cn } from '@/lib/utils/cn';
import { RICH_TEXT_CLASS } from './rich-text-class';

// Editor de texto con formato: solo negrita, cursiva y listas. Devuelve HTML;
// el servidor lo limpia igual al guardar (src/domain/research.ts).

export function RichTextEditor({
  initial,
  onChange,
  label,
  placeholder,
  disabled,
}: {
  initial: string;
  onChange: (html: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
        underline: false,
      }),
    ],
    content: initial,
    editable: !disabled,
    // Se arma recién en el navegador, para que no choque con lo que manda el servidor.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': label,
        'aria-multiline': 'true',
        role: 'textbox',
        class: cn('min-h-[9rem] px-3 py-2 text-sm leading-relaxed outline-none', RICH_TEXT_CLASS),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });

  // Mientras se guarda, no se puede escribir.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      bullet: editor?.isActive('bulletList') ?? false,
      ordered: editor?.isActive('orderedList') ?? false,
      empty: editor?.isEmpty ?? true,
    }),
  });

  const tools = [
    { key: 'bold', label: 'Negrita', icon: Bold, on: active?.bold, run: () => editor?.chain().focus().toggleBold().run() },
    { key: 'italic', label: 'Cursiva', icon: Italic, on: active?.italic, run: () => editor?.chain().focus().toggleItalic().run() },
    { key: 'bullet', label: 'Lista con viñetas', icon: List, on: active?.bullet, run: () => editor?.chain().focus().toggleBulletList().run() },
    {
      key: 'ordered',
      label: 'Lista numerada',
      icon: ListOrdered,
      on: active?.ordered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
      <div className="flex items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1" role="toolbar" aria-label="Formato">
        {tools.map((t) => (
          <IconButton
            key={t.key}
            label={t.label}
            aria-pressed={t.on}
            disabled={disabled || !editor}
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
            className={cn(t.on && 'bg-foreground/10 text-foreground')}
          >
            <t.icon className="h-4 w-4" />
          </IconButton>
        ))}
      </div>
      <div className="relative">
        {placeholder && (active?.empty ?? true) ? (
          <p className="pointer-events-none absolute left-3 top-3.5 text-sm text-muted-foreground">{placeholder}</p>
        ) : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
