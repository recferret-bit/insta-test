import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useLikeActions } from "../../state/likes";
import type { PostViewModel } from "../../state/mappers/post";
import { useIsAuthenticated } from "../../state/session";
import { loginPathFor } from "../layout/next-path";
import { Avatar } from "./Avatar";
import { CaptionText } from "./CaptionText";
import { Icon } from "./Icon";
import { LikeButton } from "./LikeButton";
import { MediaCarousel } from "./MediaCarousel";
import { PostMenu } from "./PostMenu";
import "./PostCard.css";

export type PostCardProps = {
  post: PostViewModel;
  /** `feed`: compact card linking to the post; `detail`: post page (no "View all comments" link). */
  variant?: "feed" | "detail";
  /** Comment icon action on the detail page (e.g. focus the composer); feeds link to the post. */
  onCommentClick?: () => void;
  onDeleted?: () => void;
  /** Rendered below the caption (the post page puts comments here). */
  children?: ReactNode;
  className?: string;
};

/**
 * Post card (frontend/01 "PostCard"): header with author menu, media carousel (double-tap likes, never unlikes),
 * optimistic like button, like count, linkified caption and "View all N comments".
 */
export function PostCard({
  post,
  variant = "feed",
  onCommentClick,
  onDeleted,
  children,
  className,
}: PostCardProps) {
  const authenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const location = useLocation();
  const { toggle, likeOnce } = useLikeActions();

  const requireAuth = (action: () => void) => () => {
    if (authenticated) action();
    else navigate(loginPathFor(`${location.pathname}${location.search}`));
  };

  const commentButton =
    variant === "detail" && onCommentClick ? (
      <button type="button" className="post-card__action" aria-label="Comment" onClick={onCommentClick}>
        <Icon icon={MessageCircle} size={24} />
      </button>
    ) : (
      <Link className="post-card__action" to={post.path} aria-label="Comment">
        <Icon icon={MessageCircle} size={24} />
      </Link>
    );

  return (
    <article
      className={["post-card", `post-card--${variant}`, className].filter(Boolean).join(" ")}
      aria-label={`Post by @${post.author.username}`}
    >
      <header className="post-card__header">
        <Link to={post.author.profilePath} className="post-card__avatar" tabIndex={-1} aria-hidden="true">
          <Avatar src={post.author.avatarUrl} alt="" size={32} />
        </Link>
        <div className="post-card__byline">
          <Link to={post.author.profilePath} className="post-card__username">
            {post.author.username}
          </Link>
          <span className="post-card__dot" aria-hidden="true">
            •
          </span>
          <Link to={post.path} className="post-card__time">
            <time dateTime={post.createdAt} title={post.createdAtTitle}>
              {post.createdAtRelative}
            </time>
          </Link>
          {post.isEdited ? <span className="post-card__edited">· Edited</span> : null}
        </div>
        {post.isOwn ? <PostMenu post={post} onDeleted={onDeleted} showGoToPost={variant === "feed"} /> : null}
      </header>

      <MediaCarousel
        media={post.media}
        altText={post.altText}
        label={`Media of post by @${post.author.username}`}
        onDoubleActivate={requireAuth(() => likeOnce(post))}
      />

      <div className="post-card__actions">
        <LikeButton liked={post.viewerHasLiked} onToggle={requireAuth(() => toggle(post))} />
        {commentButton}
      </div>

      <p className="post-card__likes" aria-live="polite">
        {post.likeCount > 0 ? post.likeCountLabel : "Be the first to like this"}
      </p>

      {post.captionTokens.length > 0 ? (
        <CaptionText
          tokens={post.captionTokens}
          author={{ username: post.author.username, profilePath: post.author.profilePath }}
          collapsible={variant === "feed"}
        />
      ) : null}

      {variant === "feed" && post.viewCommentsLabel ? (
        <Link to={post.path} className="post-card__comments-link">
          {post.viewCommentsLabel}
        </Link>
      ) : null}

      {children}
    </article>
  );
}
