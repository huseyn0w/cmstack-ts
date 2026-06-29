import type { CommentNode } from '@cmstack-ts/config';

export interface FlatComment {
  id: string;
  parentId: string | null;
  authorName: string;
  content: string;
  createdAt: string;
  mine?: boolean;
  pending?: boolean;
}

/**
 * Build a nested comment tree from a flat, chronologically-ordered list. Replies
 * are attached under their parent; comments whose parent isn't in the set (e.g. a
 * reply to a not-yet-approved comment) are promoted to the top level so they
 * aren't lost. Input order is preserved within each level.
 */
export function buildCommentThread(flat: FlatComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  for (const c of flat) {
    nodes.set(c.id, {
      id: c.id,
      authorName: c.authorName,
      content: c.content,
      createdAt: c.createdAt,
      ...(c.mine ? { mine: true } : {}),
      ...(c.pending ? { pending: true } : {}),
      replies: [],
    });
  }

  const roots: CommentNode[] = [];
  for (const c of flat) {
    const node = nodes.get(c.id);
    if (!node) continue;
    const parent = c.parentId ? nodes.get(c.parentId) : undefined;
    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
