import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEffect, useState, useMemo } from 'react'
import { Button } from './ui/button'

const getWsUrl = () => {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
};

interface RichTextEditorProps {
    documentId: string;
    currentUser: { id: string; name: string; initials: string };
    isReadonly?: boolean;
    initialContent?: string;
}

export const RichTextEditor = ({ documentId, currentUser, isReadonly, initialContent }: RichTextEditorProps) => {
    // Generate a random color for the cursor
    const cursorColor = useMemo(() => {
        const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'];
        return colors[Math.floor(Math.random() * colors.length)];
    }, []);

    const ydoc = useMemo(() => new Y.Doc(), []);

    const [provider, setProvider] = useState<WebsocketProvider | null>(null);

    useEffect(() => {
        if (isReadonly) return; // Don't connect websocket for readonly view

        const wsUrl = getWsUrl();
        const wsProvider = new WebsocketProvider(
            `${wsUrl}/api/collaboration`,
            documentId,
            ydoc,
            { connect: true }
        );

        setProvider(wsProvider);

        return () => {
            wsProvider.destroy();
        };
    }, [documentId, ydoc, isReadonly]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Collaboration extension comes with its own history handling
                // @ts-ignore - StarterKit types might be missing history option in this version
                history: false,
            }),
            Collaboration.configure({
                document: ydoc,
            }),
            CollaborationCursor.configure({
                provider: provider,
                user: {
                    name: currentUser.name,
                    color: cursorColor,
                },
            }),
        ],
        editable: !isReadonly,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base dark:prose-invert focus:outline-none min-h-[150px] p-3 border border-zinc-200 dark:border-zinc-800 rounded-md',
            },
        },
    });

    useEffect(() => {
        if (isReadonly && initialContent && editor && !editor.isDestroyed) {
             // For readonly mode where we might just be showing a past version
             editor.commands.setContent(initialContent);
        }
    }, [isReadonly, initialContent, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            {!isReadonly && (
                <div className="flex flex-wrap gap-1 items-center p-1 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950">
                    <Button
                        type="button"
                        variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className="h-8 px-2"
                    >
                        Bold
                    </Button>
                    <Button
                        type="button"
                        variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className="h-8 px-2"
                    >
                        Italic
                    </Button>
                    <Button
                        type="button"
                        variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className="h-8 px-2"
                    >
                        Strike
                    </Button>
                    <Button
                        type="button"
                        variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className="h-8 px-2"
                    >
                        Bullet List
                    </Button>
                    <Button
                        type="button"
                        variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className="h-8 px-2"
                    >
                        Ordered List
                    </Button>
                </div>
            )}
            
            <div className="relative">
               <EditorContent editor={editor} />
               {!isReadonly && provider && (
                   <div className="absolute top-2 right-2 text-xs text-zinc-400">
                       {provider.wsconnected ? "🟢 Syncing" : "🔴 Offline"}
                   </div>
               )}
            </div>
            
            <style>{`
                /* TipTap Collaboration Cursor Styles */
                .collaboration-cursor__caret {
                    border-left: 1px solid #0d0d0d;
                    border-right: 1px solid #0d0d0d;
                    margin-left: -1px;
                    margin-right: -1px;
                    pointer-events: none;
                    position: relative;
                    word-break: normal;
                }
                
                .collaboration-cursor__label {
                    border-radius: 3px 3px 3px 0;
                    color: #fff;
                    font-size: 12px;
                    font-style: normal;
                    font-weight: 600;
                    left: -1px;
                    line-height: normal;
                    padding: 0.1rem 0.3rem;
                    position: absolute;
                    top: -1.4em;
                    user-select: none;
                    white-space: nowrap;
                }
            `}</style>
        </div>
    );
}
