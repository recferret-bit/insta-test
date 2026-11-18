import { Link, useLocation } from "react-router-dom";

import { useFollowMutation } from "../../state/follows";
import { useIsAuthenticated, useMe } from "../../state/session";
import { loginPathFor } from "../layout/next-path";
import { Button, type ButtonSize } from "./Button";

export type FollowButtonUser = {
  /** `usr_…`, used to patch cached profiles / user summaries. */
  id: string;
  username: string;
  /** `null` = unknown (anonymous data or self). */
  isFollowing: boolean | null;
};

export type FollowButtonProps = {
  user: FollowButtonUser;
  size?: ButtonSize;
  block?: boolean;
};

/**
 * Optimistic Follow / Following toggle (F-FE-06). Hidden for the viewer's own account; when signed out it is a link
 * to `/login?next=<current path>`. While a request is in flight the requested state is shown and further clicks are
 * ignored; on error the caches roll back and a toast is shown (`state/follows`).
 */
export function FollowButton({ user, size = "sm", block = false }: FollowButtonProps) {
  const authenticated = useIsAuthenticated();
  const me = useMe();
  const location = useLocation();
  const mutation = useFollowMutation();

  if (!authenticated) {
    const classes = ["btn", "btn--primary", `btn--${size}`, block && "btn--block"].filter(Boolean).join(" ");
    return (
      <Link
        className={classes}
        to={loginPathFor(`${location.pathname}${location.search}`)}
        aria-label={`Log in to follow ${user.username}`}
      >
        <span className="btn__label">Follow</span>
      </Link>
    );
  }
  if (me?.id === user.id) return null;

  const pending = mutation.isPending;
  const following = pending && mutation.variables ? mutation.variables.follow : user.isFollowing === true;

  const toggle = () => {
    if (pending) return;
    mutation.mutate({ user: { id: user.id, username: user.username }, follow: !following });
  };

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size={size}
      block={block}
      data-following={following}
      aria-disabled={pending || undefined}
      aria-label={following ? `Unfollow ${user.username}` : `Follow ${user.username}`}
      onClick={toggle}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
