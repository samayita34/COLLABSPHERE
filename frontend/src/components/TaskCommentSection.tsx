import { useState, useEffect } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import { MentionList } from './MentionList';
import { fetchTaskCommentsApi, createTaskCommentApi, deleteTaskCommentApi } from '../services/projectApi';
import type { TaskComment, Member } from '../services/projectApi';
import { Send, Trash2, Reply } from 'lucide-react';

interface TaskCommentSectionProps {
    projectId: string;
    taskId: string;
    projectMembers: Member[];
}

export function TaskCommentSection({ projectId, taskId, projectMembers }: TaskCommentSectionProps) {
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [loading, setLoading] = useState(false);
    const [replyTo, setReplyTo] = useState<TaskComment | null>(null);

    const loadComments = async () => {
        setLoading(true);
        try {
            const data = await fetchTaskCommentsApi(projectId, taskId);
            setComments(data);
        } catch (error) {
            console.error("Failed to load comments:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadComments();
    }, [projectId, taskId]);

    const handleDelete = async (commentId: string) => {
        try {
            await deleteTaskCommentApi(projectId, commentId);
            loadComments();
        } catch (error) {
            console.error("Failed to delete comment:", error);
        }
    };

    return (
        <div className="mt-8 flex flex-col h-full border-t border-border pt-4">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Discussions</h3>
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {loading && <p className="text-muted-foreground text-sm">Loading comments...</p>}
                {!loading && comments.length === 0 && <p className="text-muted-foreground text-sm">No comments yet. Start the discussion!</p>}
                {comments.map(comment => (
                    <CommentItem 
                        key={comment.id} 
                        comment={comment} 
                        onReply={() => setReplyTo(comment)} 
                        onDelete={() => handleDelete(comment.id)} 
                    />
                ))}
            </div>

            <div className="mt-auto bg-muted/30 p-3 rounded-lg border border-border relative">
                {replyTo && (
                    <div className="flex items-center justify-between bg-muted text-muted-foreground px-3 py-1 mb-2 text-xs rounded-md">
                        <span>Replying to <strong>{replyTo.author.fullName}</strong></span>
                        <button onClick={() => setReplyTo(null)} className="hover:text-foreground">&times;</button>
                    </div>
                )}
                <CommentInput 
                    projectId={projectId} 
                    taskId={taskId} 
                    parentId={replyTo?.id} 
                    members={projectMembers} 
                    onCommentAdded={() => {
                        setReplyTo(null);
                        loadComments();
                    }} 
                />
            </div>
        </div>
    );
}

function CommentItem({ comment, onReply, onDelete }: { comment: TaskComment, onReply: () => void, onDelete: () => void }) {
    return (
        <div className="flex space-x-3 group">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs shrink-0">
                {comment.author.initials}
            </div>
            <div className="flex-1">
                <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm text-foreground">{comment.author.fullName}</span>
                    <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-sm text-foreground mt-1 whitespace-pre-wrap tiptap prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: comment.text }} />
                
                <div className="flex space-x-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onReply} className="text-xs text-muted-foreground hover:text-foreground flex items-center">
                        <Reply className="w-3 h-3 mr-1" /> Reply
                    </button>
                    <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-600 flex items-center">
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </button>
                </div>

                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-3 pl-4 border-l-2 border-muted">
                        {comment.replies.map(reply => (
                            <CommentItem key={reply.id} comment={reply} onReply={onReply} onDelete={onDelete} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CommentInput({ projectId, taskId, parentId, members, onCommentAdded }: { projectId: string, taskId: string, parentId?: string, members: Member[], onCommentAdded: () => void }) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Mention.configure({
                HTMLAttributes: {
                    class: 'text-primary font-medium bg-primary/10 rounded-sm px-1',
                },
                suggestion: {
                    items: ({ query }: { query: string }) => {
                        return members.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
                    },
                    render: () => {
                        let component: ReactRenderer<any>;
                        let popup: any[];

                        return {
                            onStart: (props: any) => {
                                component = new ReactRenderer(MentionList, {
                                    props,
                                    editor: props.editor,
                                });

                                if (!props.clientRect) {
                                    return;
                                }

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
                            onUpdate(props: any) {
                                component.updateProps(props);
                                if (!props.clientRect) return;
                                popup[0].setProps({
                                    getReferenceClientRect: props.clientRect,
                                });
                            },
                            onKeyDown(props: any) {
                                if (props.event.key === 'Escape') {
                                    popup[0].hide();
                                    return true;
                                }
                                return component.ref?.onKeyDown(props);
                            },
                            onExit() {
                                popup[0].destroy();
                                component.destroy();
                            },
                        };
                    },
                },
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert focus:outline-none min-h-[60px] p-2 text-foreground max-h-[150px] overflow-y-auto',
                placeholder: 'Write a comment... (Type @ to mention someone)',
            },
        },
    });

    const submitComment = async () => {
        if (!editor || editor.isEmpty || isSubmitting) return;

        setIsSubmitting(true);
        const html = editor.getHTML();
        
        // Extract mentions by parsing the HTML or accessing editor document
        // Tiptap mentions generate `<span data-type="mention" data-id="userId">`
        const mentionMatches = [...html.matchAll(/data-id="([^"]+)"/g)];
        const mentions = [...new Set(mentionMatches.map(m => m[1]))];

        try {
            await createTaskCommentApi(projectId, taskId, {
                text: html,
                parentId,
                mentions
            });
            editor.commands.clearContent();
            onCommentAdded();
        } catch (error) {
            console.error("Failed to post comment", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col relative bg-background rounded-md border border-input focus-within:ring-1 focus-within:ring-primary">
            <EditorContent editor={editor} />
            <div className="flex justify-between items-center p-2 border-t border-border bg-muted/20">
                <span className="text-xs text-muted-foreground ml-1">Type <kbd className="bg-muted px-1 rounded">@</kbd> to mention</span>
                <button 
                    disabled={isSubmitting || !editor || editor.isEmpty}
                    onClick={submitComment}
                    className="flex items-center px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send className="w-3 h-3 mr-1.5" />
                    {isSubmitting ? "Posting..." : "Post"}
                </button>
            </div>
        </div>
    );
}
