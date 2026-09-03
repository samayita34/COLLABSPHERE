import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEffect, useMemo, useState } from 'react'
import { Button } from './ui/button'

interface RichTextEditorProps {
    documentId: string
    currentUser: {
        id: string
        name: string
        initials: string
    }
    isReadonly?: boolean
    initialContent?: string
}

/**
 * Get the WebSocket base URL.
 *
 * Supported:
 * VITE_WS_URL=ws://localhost:3000
 * OR
 * VITE_API_URL=http://localhost:3000/api
 */
const getWsBaseUrl = () => {
    const configuredWsUrl = import.meta.env.VITE_WS_URL

    if (configuredWsUrl) {
        return configuredWsUrl
            .replace(/\/api\/collaboration\/?$/, '')
            .replace(/\/api\/?$/, '')
            .replace(/\/$/, '')
    }

    const apiUrl =
        import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

    return apiUrl
        .replace(/\/api\/collaboration\/?$/, '')
        .replace(/\/api\/?$/, '')
        .replace(/^http:/, 'ws:')
        .replace(/^https:/, 'wss:')
        .replace(/\/$/, '')
}

export const RichTextEditor = ({
    documentId,
    currentUser: _currentUser,
    isReadonly = false,
    initialContent,
}: RichTextEditorProps) => {
    /*
     * One Y.Doc per document.
     *
     * IMPORTANT:
     * The editor itself does NOT wait for the WebSocket provider.
     * This prevents a failed WebSocket connection from crashing
     * the editor UI.
     */
    const ydoc = useMemo(() => {
        return new Y.Doc()
    }, [documentId])

    const [provider, setProvider] =
        useState<WebsocketProvider | null>(null)

    const [isConnected, setIsConnected] = useState(false)

    /*
     * Create the WebSocket provider separately from the editor.
     */
    useEffect(() => {
        if (isReadonly) {
            setProvider(null)
            setIsConnected(false)
            return
        }

        let wsProvider: WebsocketProvider | null = null

        try {
            const wsBaseUrl = getWsBaseUrl()

            const collaborationUrl =
                `${wsBaseUrl}/api/collaboration`

            console.log(
                '[Collaboration] Connecting to:',
                collaborationUrl,
                'document:',
                documentId
            )

            wsProvider = new WebsocketProvider(
                collaborationUrl,
                documentId,
                ydoc,
                {
                    connect: true,
                }
            )

            const handleStatus = (event: { status: string }) => {
                console.log(
                    '[Collaboration] WebSocket status:',
                    event.status
                )

                setIsConnected(event.status === 'connected')
            }

            const handleSync = (synced: boolean) => {
                console.log(
                    '[Collaboration] Sync:',
                    synced
                )

                if (synced) {
                    setIsConnected(true)
                }
            }

            wsProvider.on('status', handleStatus)
            wsProvider.on('sync', handleSync)

            setProvider(wsProvider)

            return () => {
                console.log(
                    '[Collaboration] Cleaning up provider'
                )

                wsProvider?.off('status', handleStatus)
                wsProvider?.off('sync', handleSync)
                wsProvider?.destroy()

                setProvider(null)
                setIsConnected(false)
            }
        } catch (error) {
            console.error(
                '[Collaboration] Failed to initialize:',
                error
            )

            setProvider(null)
            setIsConnected(false)
        }
    }, [documentId, ydoc, isReadonly])

    /*
     * Destroy the Y.Doc when this document editor is removed.
     */
    useEffect(() => {
        return () => {
            ydoc.destroy()
        }
    }, [ydoc])

    /*
     * IMPORTANT:
     *
     * The editor only depends on Y.Doc.
     * It does NOT depend on `provider`.
     *
     * This prevents the editor from being destroyed/recreated
     * whenever the WebSocket connection changes.
     *
     * We are also intentionally NOT using yCursorPlugin here.
     * That was the source of the:
     *
     * "Cannot read properties of undefined (reading 'doc')"
     *
     * crash.
     */
    const extensions = useMemo(() => {
        return [
            StarterKit.configure({
                // Collaboration provides its own history handling.
                undoRedo: false,
            }),

            Collaboration.configure({
                document: ydoc,
            }),
        ]
    }, [ydoc])

    /*
     * Create the editor immediately.
     */
    const editor = useEditor(
        {
            extensions,

            editable: !isReadonly,

            editorProps: {
                attributes: {
                    class:
                        'prose prose-sm sm:prose-base dark:prose-invert ' +
                        'focus:outline-none min-h-[150px] p-3 ' +
                        'border border-zinc-200 dark:border-zinc-800 ' +
                        'rounded-md',
                },
            },
        },
        [ydoc, isReadonly]
    )

    /*
     * Used for readonly/version-history mode.
     */
    useEffect(() => {
        if (
            isReadonly &&
            initialContent &&
            editor &&
            !editor.isDestroyed
        ) {
            editor.commands.setContent(initialContent)
        }
    }, [
        isReadonly,
        initialContent,
        editor,
    ])

    /*
     * Show a small loading state instead of returning a completely
     * blank page while Tiptap initializes.
     */
    if (!editor) {
        return (
            <div className="flex items-center justify-center min-h-[150px] border border-zinc-200 dark:border-zinc-800 rounded-md">
                <span className="text-sm text-zinc-500">
                    Loading editor...
                </span>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">

            {/* Toolbar */}
            {!isReadonly && (
                <div className="flex flex-wrap gap-1 items-center p-1 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950">

                    {/* Bold */}
                    <Button
                        type="button"
                        variant={
                            editor.isActive('bold')
                                ? 'secondary'
                                : 'ghost'
                        }
                        size="sm"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleBold()
                                .run()
                        }
                        className="h-8 px-2"
                    >
                        Bold
                    </Button>

                    {/* Italic */}
                    <Button
                        type="button"
                        variant={
                            editor.isActive('italic')
                                ? 'secondary'
                                : 'ghost'
                        }
                        size="sm"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleItalic()
                                .run()
                        }
                        className="h-8 px-2"
                    >
                        Italic
                    </Button>

                    {/* Strike */}
                    <Button
                        type="button"
                        variant={
                            editor.isActive('strike')
                                ? 'secondary'
                                : 'ghost'
                        }
                        size="sm"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleStrike()
                                .run()
                        }
                        className="h-8 px-2"
                    >
                        Strike
                    </Button>

                    {/* Bullet List */}
                    <Button
                        type="button"
                        variant={
                            editor.isActive('bulletList')
                                ? 'secondary'
                                : 'ghost'
                        }
                        size="sm"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleBulletList()
                                .run()
                        }
                        className="h-8 px-2"
                    >
                        Bullet List
                    </Button>

                    {/* Ordered List */}
                    <Button
                        type="button"
                        variant={
                            editor.isActive('orderedList')
                                ? 'secondary'
                                : 'ghost'
                        }
                        size="sm"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleOrderedList()
                                .run()
                        }
                        className="h-8 px-2"
                    >
                        Ordered List
                    </Button>
                </div>
            )}

            {/* Editor */}
            <div className="relative">
                <EditorContent editor={editor} />

                {/* Collaboration status */}
                {!isReadonly && provider && (
                    <div className="absolute top-2 right-2 text-xs text-zinc-400 bg-white/80 dark:bg-zinc-950/80 px-2 py-1 rounded">
                        {isConnected
                            ? '🟢 Syncing'
                            : '🔴 Offline'}
                    </div>
                )}

                {/* If provider hasn't initialized yet */}
                {!isReadonly && !provider && (
                    <div className="absolute top-2 right-2 text-xs text-zinc-400 bg-white/80 dark:bg-zinc-950/80 px-2 py-1 rounded">
                        🔴 Offline
                    </div>
                )}
            </div>
        </div>
    )
}