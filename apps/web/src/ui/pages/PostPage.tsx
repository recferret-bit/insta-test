import { ImageOff } from "lucide-react";
import { useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCommentsQuery, useDeleteCommentMutation, type CommentViewModel } from "../../state/comments";
import { errorMessage, isApiError, isNotFound } from "../../state/errors";
import { usePostQuery } from "../../state/posts";
import { showToast } from "../../state/toast";
import { CommentComposer } from "../components/CommentComposer";
import { CommentList } from "../components/CommentList";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { PostCard } from "../components/PostCard";
import { Skeleton } from "../components/Skeleton";
import { useDocumentTitle } from "../layout/useDocumentTitle";
import "./PostPage.css";

function PostSkeleton() {
  return (
    <div className="post-page__skeleton" aria-busy="true" aria-label="Loading post">
      <div className="post-page__skeleton-header">
        <Skeleton circle width={32} height={32} />
        <Skeleton width={120} height={14} />
      </div>
      <Skeleton height={0} className="post-page__skeleton-media" radius="var(--radius-sm)" />
      <Skeleton width="40%" height={14} />
      <Skeleton width="80%" height={14} />
    </div>
  );
}

/**
 * `/p/:postId` (auth optional) — F-FE-05: media carousel, optimistic like (button & double-tap), comments
 * (infinite, oldest first) with composer, author menu (edit caption / delete).
 */
export function PostPage() {
  const { postId = "" } = useParams();
  const navigate = useNavigate();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const post = usePostQuery(postId);
  const data = post.data;
  const comments = useCommentsQuery(postId, data ? data.author.id : undefined);
  const deleteComment = useDeleteCommentMutation();
  useDocumentTitle(data ? `@${data.author.username} on Insta-test` : "Post");

  if (post.isPending) {
    return (
      <section className="page page--narrow post-page">
        <h1 className="visually-hidden">Post</h1>
        <PostSkeleton />
      </section>
    );
  }

  if (post.isError || !data) {
    const missing = isNotFound(post.error) || (isApiError(post.error) && post.error.status === 400);
    return (
      <section className="page page--narrow post-page">
        {missing ? (
          <EmptyState
            icon={ImageOff}
            headingLevel="h1"
            title="Post not available"
            message="The link may be broken, or the post may have been removed."
            action={<Link to="/">Go home</Link>}
          />
        ) : (
          <>
            <h1 className="visually-hidden">Post</h1>
            <ErrorState
              title="Couldn't load this post"
              message={errorMessage(post.error)}
              onRetry={() => void post.refetch()}
            />
          </>
        )}
      </section>
    );
  }

  const items: CommentViewModel[] = comments.data?.pages.flatMap((p) => p.items) ?? [];

  const onDeleteComment = (comment: CommentViewModel) =>
    deleteComment.mutate(
      { postId: data.id, commentId: comment.id },
      { onError: (error) => showToast(`Couldn't delete comment: ${errorMessage(error)}`, { tone: "error" }) },
    );

  return (
    <section className="page page--narrow post-page">
      <h1 className="visually-hidden">{`Post by @${data.author.username}`}</h1>
      <PostCard
        post={data}
        variant="detail"
        onCommentClick={() => composerRef.current?.focus()}
        onDeleted={() => navigate(data.author.profilePath, { replace: true })}
      >
        <section className="post-page__comments" aria-labelledby="post-comments-title">
          <h2 id="post-comments-title" className="post-page__comments-title">
            {data.commentCount > 0 ? `Comments (${data.commentCount})` : "Comments"}
          </h2>
          {comments.isError ? (
            <ErrorState
              title="Couldn't load comments"
              message={errorMessage(comments.error)}
              onRetry={() => void comments.refetch()}
            />
          ) : (
            <CommentList
              comments={items}
              loading={comments.isPending}
              hasMore={comments.hasNextPage}
              loadingMore={comments.isFetchingNextPage}
              onLoadMore={() => {
                if (!comments.isFetchingNextPage) void comments.fetchNextPage();
              }}
              onDelete={onDeleteComment}
            />
          )}
          <CommentComposer ref={composerRef} postId={data.id} postAuthorId={data.author.id} />
        </section>
      </PostCard>
    </section>
  );
}
