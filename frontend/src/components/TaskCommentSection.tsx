import { useState, useEffect } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import { MentionList } from './MentionList';
import { fetchTaskCommentsApi, createTaskCommentApi, deleteTaskCommentApi } from '../services/projectApi';
import type { TaskComment, Member } from '../services/projectApi';
import { socketService } from '../services/socket';
import './TaskCommentSection.css';

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

        const socket = socketService.connect();
        socketService.joinProject(projectId);

        const handleNewComment = (data: { taskId: string; comment: TaskComment }) => {
            if (data?.taskId === taskId) {
                loadComments();
            }
        };

        const handleDeletedComment = (data: { taskId: string; commentId: string }) => {
            if (data?.taskId === taskId) {
                loadComments();
            }
        };

        socket.on("task_comment_created", handleNewComment);
        socket.on("task_comment_deleted", handleDeletedComment);

        return () => {
            socket.off("task_comment_created", handleNewComment);
            socket.off("task_comment_deleted", handleDeletedComment);
        };
    }, [projectId, taskId]);

    const handleDelete = async (commentId: string) => {
        try {
            await deleteTaskCommentApi(projectId, commentId);
            loadComments();
        } catch (error) {
            console.error("Failed to delete comment:", error);
        }
    };

    const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies ? c.replies.length : 0), 0);

    return (
        <div className="task-discussion-wrapper">
            <div className="task-discussion-header">
                <h4 className="task-discussion-title">
                    Discussion
                    {totalComments > 0 && (
                        <span className="task-discussion-count">{totalComments}</span>
                    )}
                </h4>
            </div>

            <div className="task-discussion-list">
                {loading && <div className="task-discussion-empty">Loading discussion...</div>}
                {!loading && comments.length === 0 && (
                    <div className="task-discussion-empty">
                        No comments yet. Start the discussion!
                    </div>
                )}
                {comments.map((comment) => (
                    <CommentItem
                        key={comment.id}
                        comment={comment}
                        onReply={() => setReplyTo(comment)}
                        onDelete={() => handleDelete(comment.id)}
                    />
                ))}
            </div>

            <div className="task-comment-composer">
                {replyTo && (
                    <div className="task-comment-reply-banner">
                        <span>Replying to <strong>{replyTo.author?.fullName || "Member"}</strong></span>
                        <button
                            type="button"
                            onClick={() => setReplyTo(null)}
                            className="task-comment-reply-close"
                            title="Cancel reply"
                        >
                            &times;
                        </button>
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

function CommentItem({
    comment,
    onReply,
    onDelete,
}: {
    comment: TaskComment;
    onReply: () => void;
    onDelete: () => void;
}) {
    const formatTime = (isoString: string) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    return (
        <div className="task-comment-item">
            <div className="task-comment-avatar">
                {comment.author?.initials || "US"}
            </div>
            <div className="task-comment-body">
                <div className="task-comment-header">
                    <span className="task-comment-author">
                        {comment.author?.fullName || "Member"}
                    </span>
                    <span className="task-comment-time">
                        {formatTime(comment.createdAt)}
                    </span>
                </div>
                <div
                    className="task-comment-text"
                    dangerouslySetInnerHTML={{ __html: comment.text }}
                />

                <div className="task-comment-actions">
                    <button type="button" onClick={onReply} className="task-comment-btn">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 17 4 12 9 7" />
                            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                        </svg>
                        Reply
                    </button>
                    <button type="button" onClick={onDelete} className="task-comment-btn delete">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Delete
                    </button>
                </div>

                {comment.replies && comment.replies.length > 0 && (
                    <div className="task-comment-replies">
                        {comment.replies.map((reply) => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                onReply={onReply}
                                onDelete={onDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CommentInput({
    projectId,
    taskId,
    parentId,
    members,
    onCommentAdded,
}: {
    projectId: string;
    taskId: string;
    parentId?: string;
    members: Member[];
    onCommentAdded: () => void;
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Mention.configure({
                HTMLAttributes: {
                    class: 'mention-tag',
                    style: 'color: #4f46e5; font-weight: 600; background: #eef2ff; padding: 1px 4px; border-radius: 3px;',
                },
                suggestion: {
                    items: ({ query }: { query: string }) => {
                        return (members || [])
                            .filter((item) => (item.name || "").toLowerCase().includes(query.toLowerCase()))
                            .slice(0, 5);
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
                            onUpdate(props: any) {
                                component?.updateProps(props);
                                if (!props.clientRect) return;
                                popup?.[0]?.setProps({
                                    getReferenceClientRect: props.clientRect,
                                });
                            },
                            onKeyDown(props: any) {
                                if (props.event.key === 'Escape') {
                                    popup?.[0]?.hide();
                                    return true;
                                }
                                return component?.ref?.onKeyDown(props);
                            },
                            onExit() {
                                popup?.[0]?.destroy();
                                component?.destroy();
                            },
                        };
                    },
                },
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'task-comment-input-area',
                placeholder: 'Write a comment... (Type @ to mention someone)',
            },
        },
    });

    const submitComment = async () => {
        if (!editor || editor.isEmpty || isSubmitting) return;

        setIsSubmitting(true);
        const html = editor.getHTML();

        const mentionMatches = [...html.matchAll(/data-id="([^"]+)"/g)];
        const mentions = [...new Set(mentionMatches.map((m) => m[1]))];

        try {
            await createTaskCommentApi(projectId, taskId, {
                text: html,
                parentId,
                mentions,
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
        <div>
            <EditorContent editor={editor} />
            <div className="task-comment-footer">
                <span className="task-comment-hint">
                    Type <kbd>@</kbd> to mention team members
                </span>
                <button
                    type="button"
                    disabled={isSubmitting || !editor || editor.isEmpty}
                    onClick={submitComment}
                    className="task-comment-send-btn"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    {isSubmitting ? "Posting..." : "Comment"}
                </button>
            </div>
        </div>
    );
}
