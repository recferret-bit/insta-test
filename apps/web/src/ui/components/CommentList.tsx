import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import type { CommentViewModel } from "../../state/mappers/comment";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";
import "./CommentList.css";

export type CommentListProps = {
  comments: readonly CommentViewModel[];
  /** First page still loading. */
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onDelete?: (comment: CommentViewModel) => void;
  /** Auto-load the next page when the end of the list scrolls into view (default true). */
  autoLoad?: boolean;
};

/** Flat comment list, oldest first, with infinite loading (sentinel + "Load more comments" fallback button). */
export function CommentList({
  comments,
  loading = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onDelete,
  autoLoad = true,
}: CommentListProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useRef(onLoadMore);
  loadMore.current = onLoadMore;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !autoLoad || !hasMore || loadingMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore.current?.();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoLoad, hasMore, loadingMore]);

  if (loading) {
    return (
      <div className="comment-list comment-list--loading" aria-busy="true" aria-label="Loading comments">
        {[0, 1, 2].map((i) => (
          <div key={i} className="comment">
            <Skeleton circle width={32} height={32} />
            <Skeleton width={`${60 - i * 10}%`} height={14} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="comment-list">
      {comments.length === 0 ? <p className="comment-list__empty">No comments yet.</p> : null}
      <ul className="comment-list__items" aria-label="Comments">
        {comments.map((comment) => (
          <li key={comment.id} className="comment">
            <Link to={comment.author.profilePath} tabIndex={-1} aria-hidden="true">
              <Avatar src={comment.author.avatarUrl} alt="" size={32} />
            </Link>
            <div className="comment__body">
              <p className="comment__text">
                <Link to={comment.author.profilePath} className="comment__author">
                  {comment.author.username}
                </Link>{" "}
                {comment.text}
              </p>
              <time className="comment__time" dateTime={comment.createdAt} title={comment.createdAtTitle}>
                {comment.createdAtRelative}
              </time>
            </div>
            {comment.canDelete && onDelete ? (
              <button
                type="button"
                className="comment__delete"
                aria-label={`Delete comment by @${comment.author.username}`}
                onClick={() => onDelete(comment)}
              >
                <Icon icon={Trash2} size={16} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {hasMore ? (
        <div ref={sentinel} className="comment-list__more">
          <Button variant="ghost" size="sm" onClick={onLoadMore} loading={loadingMore}>
            Load more comments
          </Button>
        </div>
      ) : null}
    </div>
  );
}
