import { Users } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { errorMessage } from "../../state/errors";
import { flattenFollowList, useFollowList, type FollowListKind } from "../../state/follows";
import { profilePathFor } from "../../state/mappers/user";
import { EmptyState, ErrorState } from "./EmptyState";
import { FollowButton } from "./FollowButton";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { UserRow } from "./UserRow";
import "./FollowListModal.css";

export type FollowListModalProps = {
  username: string;
  kind: FollowListKind;
  /** Defaults to navigating back to `/u/:username` (the modal is route-driven). */
  onClose?: () => void;
};

const TITLES: Record<FollowListKind, string> = { followers: "Followers", following: "Following" };

const EMPTY: Record<FollowListKind, { title: string; message: string }> = {
  followers: { title: "No followers yet", message: "When people follow this account, they'll appear here." },
  following: { title: "Not following anyone", message: "Accounts this user follows will appear here." },
};

/**
 * Calls `onVisible` whenever the sentinel scrolls into view (no-op without `IntersectionObserver`). The observer is
 * re-created when `resetKey` changes so a sentinel that stays visible after a page loads fires again.
 */
function useSentinel(onVisible: () => void, enabled: boolean, resetKey: number) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onVisible);
  callback.current = onVisible;
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, resetKey]);
  return ref;
}

/**
 * Route-driven followers / following list (`/u/:username/followers|following`, F-FE-06): infinite list of
 * `UserRow` + `FollowButton` inside the accessible `Modal` (focus trap; `Esc`, the close button or the backdrop go
 * back to the profile).
 */
export function FollowListModal({ username, kind, onClose }: FollowListModalProps) {
  const navigate = useNavigate();
  const close = onClose ?? (() => navigate(profilePathFor(username)));
  const query = useFollowList(kind, username);
  const users = flattenFollowList(query.data);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };
  const sentinelRef = useSentinel(
    loadMore,
    query.isSuccess && hasNextPage && !query.isFetchNextPageError,
    users.length,
  );

  let body;
  if (query.isPending) {
    body = (
      <div className="follow-list__status">
        <Spinner label={`Loading ${TITLES[kind].toLowerCase()}`} />
      </div>
    );
  } else if (query.isError && users.length === 0) {
    body = <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  } else if (users.length === 0) {
    body = (
      <EmptyState icon={Users} title={EMPTY[kind].title} message={EMPTY[kind].message} headingLevel="h3" />
    );
  } else {
    body = (
      <>
        <ul className="follow-list" aria-label={`${TITLES[kind]} of ${username}`}>
          {users.map((user) => (
            <li key={user.id} className="follow-list__item">
              <UserRow user={user} action={<FollowButton user={user} />} />
            </li>
          ))}
        </ul>
        {hasNextPage ? (
          <div ref={sentinelRef} className="follow-list__status">
            {isFetchingNextPage ? (
              <Spinner label="Loading more" />
            ) : query.isFetchNextPageError ? (
              <ErrorState message={errorMessage(query.error)} onRetry={loadMore} />
            ) : (
              <button type="button" className="follow-list__more" onClick={loadMore}>
                Load more
              </button>
            )}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Modal open onClose={close} title={TITLES[kind]} size="sm">
      {body}
    </Modal>
  );
}
