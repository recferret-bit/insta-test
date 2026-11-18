import { Film, Heart, Layers, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { formatCompactNumber } from "../../state/mappers/format";
import type { PostViewModel } from "../../state/mappers/post";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";
import "./PostGrid.css";

export type PostGridTileProps = { post: PostViewModel };

/** Accessible name of a grid tile: alt text plus counters (the hover overlay is decorative). */
export function tileLabel(post: PostViewModel): string {
  const kind = post.media[0]?.isVideo ? "Video" : "Photo";
  const multi = post.hasMultipleMedia ? `, ${post.media.length} items` : "";
  return `${kind}${multi}: ${post.altText}. ${post.likeCountLabel}, ${post.commentCount === 1 ? "1 comment" : `${post.commentCount} comments`}`;
}

/** Square tile (design-system "PostGridTile"): first media cropped, video / multi-media icon, hover counts. */
export function PostGridTile({ post }: PostGridTileProps) {
  const first = post.media[0];
  return (
    <li className="post-grid__item">
      <Link to={post.path} className="post-grid__tile" aria-label={tileLabel(post)}>
        {first?.isVideo ? (
          <video
            className="post-grid__media"
            src={first.url}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
          />
        ) : first ? (
          <img className="post-grid__media" src={first.url} alt="" loading="lazy" decoding="async" />
        ) : null}
        {post.hasMultipleMedia ? (
          <span className="post-grid__badge" data-badge="multi">
            <Icon icon={Layers} size={18} />
          </span>
        ) : first?.isVideo ? (
          <span className="post-grid__badge" data-badge="video">
            <Icon icon={Film} size={18} />
          </span>
        ) : null}
        <span className="post-grid__overlay" aria-hidden="true">
          <span className="post-grid__count">
            <Icon icon={Heart} size={18} fill="currentColor" />
            {formatCompactNumber(post.likeCount)}
          </span>
          <span className="post-grid__count">
            <Icon icon={MessageCircle} size={18} fill="currentColor" />
            {formatCompactNumber(post.commentCount)}
          </span>
        </span>
      </Link>
    </li>
  );
}

export type PostGridProps = {
  posts: readonly PostViewModel[];
  /** Number of skeleton tiles appended while a (next) page loads. */
  loadingTiles?: number;
  label?: string;
  className?: string;
};

/** 3-column square grid (profile, explore, hashtag pages). */
export function PostGrid({ posts, loadingTiles = 0, label = "Posts", className }: PostGridProps) {
  return (
    <ul
      className={["post-grid", className].filter(Boolean).join(" ")}
      aria-label={label}
      aria-busy={loadingTiles > 0 || undefined}
    >
      {posts.map((post) => (
        <PostGridTile key={post.id} post={post} />
      ))}
      {Array.from({ length: loadingTiles }, (_, i) => (
        <li key={`skeleton-${i}`} className="post-grid__item" aria-hidden="true">
          <Skeleton className="post-grid__skeleton" height="100%" radius={0} />
        </li>
      ))}
    </ul>
  );
}
