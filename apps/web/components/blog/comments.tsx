'use client';

import {
  deleteOwnComment,
  editOwnComment,
  submitAuthenticatedComment,
} from '@/app/[locale]/blog/[slug]/comment-actions';
import { getRecaptchaToken } from '@/lib/recaptcha';
import {
  COMMENT_EDIT_WINDOW_MINUTES,
  type CommentNode,
  type CommentThread,
} from '@cmstack-ts/config';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useTransition } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const EDIT_WINDOW_MS = COMMENT_EDIT_WINDOW_MINUTES * 60_000;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' });
}

function withinEditWindow(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < EDIT_WINDOW_MS;
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent)',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
};

function CommentItem({
  comment,
  depth,
  slug,
  onReply,
}: {
  comment: CommentNode;
  depth: number;
  slug: string;
  onReply: (c: CommentNode) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = comment.mine === true && withinEditWindow(comment.createdAt);

  function saveEdit() {
    setError(null);
    startTransition(async () => {
      const res = await editOwnComment(slug, comment.id, draft);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteOwnComment(slug, comment.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <li style={{ marginLeft: depth > 0 ? '1.5rem' : 0, marginTop: '1.25rem' }}>
      <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: '0.9rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{comment.authorName}</span>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {formatDate(comment.createdAt)}
          </span>
          {comment.mine && (
            <span style={{ color: 'var(--accent)', fontSize: 11 }}>
              You{comment.pending ? ' · awaiting moderation' : ''}
            </span>
          )}
        </div>

        {editing ? (
          <div style={{ marginTop: '0.4rem', display: 'grid', gap: '0.4rem' }}>
            <textarea
              aria-label="Edit comment"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.6rem',
                background: 'transparent',
                border: '1px solid var(--line)',
                borderRadius: 6,
                color: 'var(--fg)',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" style={linkBtn} disabled={isPending} onClick={saveEdit}>
                Save
              </button>
              <button
                type="button"
                style={{ ...linkBtn, color: 'var(--muted)' }}
                disabled={isPending}
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.content);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p style={{ margin: '0.3rem 0 0.4rem', fontSize: 15, whiteSpace: 'pre-wrap' }}>
            {comment.content}
          </p>
        )}

        {!editing && (
          <div style={{ display: 'flex', gap: '0.9rem' }}>
            <button type="button" onClick={() => onReply(comment)} style={linkBtn}>
              Reply
            </button>
            {canManage && (
              <>
                <button type="button" style={linkBtn} onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button
                  type="button"
                  style={{ ...linkBtn, color: '#e06b6b' }}
                  disabled={isPending}
                  onClick={remove}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
        {error && <p style={{ margin: '0.3rem 0 0', fontSize: 12, color: '#e06b6b' }}>{error}</p>}
      </div>

      {comment.replies.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              slug={slug}
              onReply={onReply}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Comments({
  slug,
  initialThread,
  signedIn = false,
}: {
  slug: string;
  initialThread: CommentThread;
  signedIn?: boolean;
}) {
  const router = useRouter();
  const [replyTo, setReplyTo] = useState<CommentNode | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      if (signedIn) {
        // Attributed submit via a server action (uses the session token server-side).
        const res = await submitAuthenticatedComment(slug, content, replyTo?.id);
        if (!res.ok) {
          setMessage({ ok: false, text: res.error });
          return;
        }
        setMessage({ ok: true, text: 'Thanks! Your comment is awaiting moderation.' });
        setContent('');
        setReplyTo(null);
        router.refresh();
        return;
      }

      const recaptchaToken = await getRecaptchaToken('comment');
      const res = await fetch(`${API_URL}/public/posts/${encodeURIComponent(slug)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: name,
          authorEmail: email,
          content,
          parentId: replyTo?.id,
          recaptchaToken,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: unknown };
        const text =
          res.status === 429
            ? 'You are commenting too fast. Please wait a moment.'
            : typeof body.message === 'string'
              ? body.message
              : 'Could not submit your comment.';
        setMessage({ ok: false, text });
        return;
      }
      setMessage({ ok: true, text: 'Thanks! Your comment is awaiting moderation.' });
      setName('');
      setEmail('');
      setContent('');
      setReplyTo(null);
    } catch {
      setMessage({ ok: false, text: 'Could not submit your comment.' });
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.7rem',
    background: 'transparent',
    border: '1px solid var(--line)',
    borderRadius: 8,
    color: 'var(--fg)',
    fontSize: 14,
    fontFamily: 'inherit',
  };

  return (
    <section
      style={{ marginTop: '3.5rem', borderTop: '1px solid var(--line)', paddingTop: '2rem' }}
    >
      <h2 style={{ fontSize: 20, margin: '0 0 1rem' }}>
        Comments{initialThread.total > 0 ? ` (${initialThread.total})` : ''}
      </h2>

      {initialThread.items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          No comments yet. Be the first to comment.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {initialThread.items.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              slug={slug}
              onReply={setReplyTo}
            />
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: '2.5rem', display: 'grid', gap: '0.75rem' }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>
          {replyTo ? `Reply to ${replyTo.authorName}` : 'Leave a comment'}
        </h3>
        {replyTo && (
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            style={{ ...linkBtn, justifySelf: 'start', color: 'var(--muted)' }}
          >
            Cancel reply
          </button>
        )}
        {!signedIn && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              aria-label="Name"
              placeholder="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 180 }}
            />
            <input
              aria-label="Email"
              type="email"
              placeholder="Email (not published)"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 180 }}
            />
          </div>
        )}
        <textarea
          aria-label="Comment"
          placeholder="Your comment…"
          required
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        {message && (
          <p style={{ fontSize: 13, color: message.ok ? 'var(--accent)' : '#e06b6b', margin: 0 }}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            justifySelf: 'start',
            padding: '0.6rem 1.2rem',
            border: '1px solid var(--line)',
            borderRadius: 999,
            background: 'var(--fg)',
            color: 'var(--bg)',
            fontSize: 14,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Post comment'}
        </button>
      </form>
    </section>
  );
}
