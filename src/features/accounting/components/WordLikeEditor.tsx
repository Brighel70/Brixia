import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { TableKit } from '@tiptap/extension-table'
import { Bold, Italic, Link2, List, ListOrdered, RemoveFormatting, Underline as UnderlineIcon } from 'lucide-react'
import { useEffect } from 'react'

interface WordLikeEditorProps {
  content: string
  onChange: (html: string) => void
  editable?: boolean
  minHeightClass?: string
}

export function WordLikeEditor({
  content,
  onChange,
  editable = true,
  minHeightClass = 'min-h-[70vh]'
}: WordLikeEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TableKit.configure({
        table: {
          resizable: false,
          HTMLAttributes: { class: 'tf-doc-table' }
        }
      })
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: `prose prose-slate max-w-none focus:outline-none px-10 py-8 ${minHeightClass} bg-white text-slate-900`
      }
    }
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (content !== current) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  if (!editor) return null

  const btn = (active: boolean) =>
    `rounded px-2 py-1.5 text-sm ${
      active ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-300 bg-slate-100 shadow-inner">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-300 bg-slate-50 px-3 py-2">
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
          value={
            editor.isActive('heading', { level: 1 })
              ? 'h1'
              : editor.isActive('heading', { level: 2 })
                ? 'h2'
                : editor.isActive('heading', { level: 3 })
                  ? 'h3'
                  : 'p'
          }
          onChange={(e) => {
            const v = e.target.value
            if (v === 'p') editor.chain().focus().setParagraph().run()
            if (v === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run()
            if (v === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run()
            if (v === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run()
          }}
        >
          <option value="p">Normale</option>
          <option value="h1">Titolo 1</option>
          <option value="h2">Titolo 2</option>
          <option value="h3">Titolo 3</option>
        </select>
        <button
          type="button"
          className={btn(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Grassetto"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn(editor.isActive('italic'))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Corsivo"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn(editor.isActive('underline'))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sottolineato"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn(editor.isActive('link'))}
          onClick={() => {
            const prev = editor.getAttributes('link').href as string | undefined
            const url = window.prompt('URL link', prev || 'https://')
            if (url === null) return
            if (!url) {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
              return
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
          }}
          title="Inserisci link"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn(editor.isActive('orderedList'))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Elenco numerato"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn(editor.isActive('bulletList'))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Elenco puntato"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn(false)}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Cancella formattazione"
        >
          <RemoveFormatting className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-200/80 p-4 md:p-6">
        <div className="mx-auto max-w-[820px] rounded-sm bg-white shadow-lg ring-1 ring-slate-300">
          <EditorContent editor={editor} />
        </div>
      </div>
      <style>{`
        .tf-fill { background: #fef3c7; border-bottom: 1px dashed #d97706; padding: 0 2px; }
        .ProseMirror table.tf-doc-table,
        .ProseMirror table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0 1.25rem;
          table-layout: fixed;
          font-size: 0.95rem;
        }
        .ProseMirror th,
        .ProseMirror td {
          border: 1px solid #94a3b8;
          padding: 10px 12px;
          vertical-align: middle;
          word-break: break-word;
        }
        .ProseMirror th {
          background: #f1f5f9;
          font-weight: 700;
          text-align: left;
          color: #0f172a;
        }
        .ProseMirror td:first-child,
        .ProseMirror th:first-child {
          width: 3rem;
          text-align: center;
        }
        .ProseMirror td:nth-child(3),
        .ProseMirror td:nth-child(4),
        .ProseMirror td:nth-child(5),
        .ProseMirror th:nth-child(3),
        .ProseMirror th:nth-child(4),
        .ProseMirror th:nth-child(5) {
          text-align: right;
        }
        .ProseMirror h1 { font-size: 1.35rem; margin: 0.8rem 0; }
        .ProseMirror h2 { font-size: 1.15rem; margin: 0.7rem 0; }
        .ProseMirror h3 { font-size: 1.05rem; margin: 0.6rem 0; }
        .ProseMirror p { margin: 0.45rem 0; line-height: 1.5; }
      `}</style>
    </div>
  )
}
