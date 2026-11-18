import { CircleDashed, Eye, Pause, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { errorMessage, isNotFound } from "../../state/errors";
import { useIsAuthenticated, useMe } from "../../state/session";
import {
  adjacentTrayUsername,
  initialStoryIndex,
  orderTray,
  useMarkStorySeenMutation,
  useStoryTrayQuery,
  useUserStoriesQuery,
  type StoryViewModel,
  type UserStoriesViewModel,
} from "../../state/stories";
import { useStoryPlayback } from "../../state/stories-playback";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";
import { StoryProgress } from "../components/StoryProgress";
import { StoryViewers } from "../components/StoryViewers";
import { useDocumentTitle } from "../layout/useDocumentTitle";
import "./StoryViewerPage.css";

/** Press longer than this on a tap zone pauses ("hold") instead of navigating. */
export const STORY_HOLD_MS = 200;

type ViewerState = { canGoBack: boolean };

function isViewerState(value: unknown): value is ViewerState {
  return typeof value === "object" && value !== null && typeof (value as ViewerState).canGoBack === "boolean";
}

export function storyPath(username: string): string {
  return `/stories/${encodeURIComponent(username)}`;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="story-viewer__icon-btn" onClick={onClose} aria-label="Close">
      <Icon icon={X} size={24} />
    </button>
  );
}

function StoryMedia({ story, paused }: { story: StoryViewModel; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (paused) video.pause();
      else void video.play()?.catch(() => undefined);
    } catch {
      /* media playback unsupported (e.g. jsdom); the progress clock still runs */
    }
  }, [paused, story.id]);

  const alt = `Story by @${story.author.username}`;
  if (story.media.isVideo)
    return (
      <video
        key={story.id}
        ref={videoRef}
        className="story-viewer__media-el"
        src={story.media.url}
        muted
        playsInline
        preload="auto"
        aria-label={alt}
      />
    );
  return <img key={story.id} className="story-viewer__media-el" src={story.media.url} alt={alt} />;
}

type StoryPlayerProps = {
  data: UserStoriesViewModel;
  /** Tray user after / before this one, or `null`. */
  nextUser: string | null;
  prevUser: string | null;
  onUser: (username: string) => void;
  onClose: () => void;
};

function StoryPlayer({ data, nextUser, prevUser, onUser, onClose }: StoryPlayerProps) {
  const authenticated = useIsAuthenticated();
  const me = useMe();
  const { mutate: markSeen } = useMarkStorySeenMutation();
  const [userPaused, setUserPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [startIndex] = useState(() => initialStoryIndex(data.stories));
  const durations = useMemo(() => data.stories.map((s) => s.durationMs), [data.stories]);
  const paused = userPaused || held || viewersOpen;

  const { state, next, prev } = useStoryPlayback({
    durations,
    initialIndex: startIndex,
    paused,
    onEnd: () => (nextUser ? onUser(nextUser) : onClose()),
    onBeforeStart: () => {
      if (!prevUser) return false;
      onUser(prevUser);
      return true;
    },
  });
  const story = data.stories[Math.min(state.index, data.stories.length - 1)]!;

  // Mark seen as soon as a story starts displaying (never for the author or anonymous viewers).
  const requested = useRef(new Set<string>());
  const isAuthor = me !== null && me.id === story.author.id;
  useEffect(() => {
    if (!authenticated || isAuthor || story.viewerHasSeen || requested.current.has(story.id)) return;
    requested.current.add(story.id);
    markSeen({ storyId: story.id, username: data.user.username });
  }, [authenticated, isAuthor, story.id, story.viewerHasSeen, data.user.username, markSeen]);

  useEffect(() => {
    if (viewersOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") prev();
      else if (event.key === "Escape") onClose();
      else if (event.key === " ") setUserPaused((p) => !p);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewersOpen, next, prev, onClose]);

  // Hold-to-pause on the tap zones; a hold swallows the click that follows it.
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const suppressClick = useRef(false);
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const onPointerDown = () => {
    suppressClick.current = false;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setHeld(true);
    }, STORY_HOLD_MS);
  };
  const onRelease = () => {
    clearTimeout(holdTimer.current);
    setHeld(false);
  };
  const onTap = (go: () => void) => () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    go();
  };
  const zoneHandlers = {
    onPointerDown,
    onPointerUp: onRelease,
    onPointerLeave: onRelease,
    onPointerCancel: onRelease,
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
  };

  return (
    <div className="story-viewer__frame" data-paused={paused || undefined}>
      <header className="story-viewer__header">
        <StoryProgress durations={durations} index={state.index} elapsedMs={state.elapsedMs} />
        <div className="story-viewer__meta">
          <Link to={story.author.profilePath} className="story-viewer__author">
            <Avatar src={story.author.avatarUrl} alt="" size={32} />
            <span className="story-viewer__username">{story.author.username}</span>
          </Link>
          <time className="story-viewer__time" dateTime={story.createdAt} title={story.remainingLabel}>
            {story.createdAtRelative}
          </time>
          <span className="story-viewer__spacer" />
          <button
            type="button"
            className="story-viewer__icon-btn"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Play" : "Pause"}
          >
            <Icon icon={userPaused ? Play : Pause} size={22} />
          </button>
          <CloseButton onClose={onClose} />
        </div>
      </header>

      <div className="story-viewer__media">
        <StoryMedia story={story} paused={paused} />
      </div>
      <button
        type="button"
        className="story-viewer__zone story-viewer__zone--prev"
        aria-label="Previous story"
        onClick={onTap(prev)}
        {...zoneHandlers}
      />
      <button
        type="button"
        className="story-viewer__zone story-viewer__zone--next"
        aria-label="Next story"
        onClick={onTap(next)}
        {...zoneHandlers}
      />

      {story.viewCountLabel !== null ? (
        <footer className="story-viewer__footer">
          <button type="button" className="story-viewer__seen-by" onClick={() => setViewersOpen(true)}>
            <Icon icon={Eye} size={18} />
            {story.viewCountLabel}
          </button>
          <StoryViewers
            storyId={story.id}
            open={viewersOpen}
            onClose={() => setViewersOpen(false)}
            title={story.viewCountLabel}
          />
        </footer>
      ) : null}
    </div>
  );
}

function ViewerMessage({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="story-viewer__frame story-viewer__frame--message">
      <div className="story-viewer__meta story-viewer__meta--end">
        <CloseButton onClose={onClose} />
      </div>
      <div className="story-viewer__message">{children}</div>
    </div>
  );
}

/**
 * `/stories/:username` (auth optional, full-screen overlay outside the shell) — F-FE-09. Plays the user's active
 * stories, then continues with the next user in tray order; `Esc` / close returns to where the viewer was opened.
 */
export function StoryViewerPage() {
  const { username = "" } = useParams();
  useDocumentTitle(`Stories • @${username}`);
  const navigate = useNavigate();
  const location = useLocation();
  const authenticated = useIsAuthenticated();
  const me = useMe();
  const stories = useUserStoriesQuery(username);
  const tray = useStoryTrayQuery({ enabled: authenticated });

  const ordered = useMemo(() => orderTray(tray.data ?? [], me?.id ?? null), [tray.data, me?.id]);
  // Hops between users replace the history entry, so "back" always leaves the viewer. Whether there is an in-app
  // entry to go back to is decided once (deep link → no) and carried across hops in the location state.
  const canGoBack = isViewerState(location.state) ? location.state.canGoBack : location.key !== "default";
  const onUser = useCallback(
    (next: string) =>
      navigate(storyPath(next), { replace: true, state: { canGoBack } satisfies ViewerState }),
    [navigate, canGoBack],
  );
  const onClose = useCallback(() => {
    if (canGoBack) navigate(-1);
    else navigate(authenticated ? "/" : `/u/${encodeURIComponent(username)}`, { replace: true });
  }, [authenticated, canGoBack, navigate, username]);

  let content: ReactNode;
  if (stories.isPending) {
    content = (
      <ViewerMessage onClose={onClose}>
        <Spinner size={32} label="Loading stories" />
      </ViewerMessage>
    );
  } else if (stories.isError && !isNotFound(stories.error)) {
    content = (
      <ViewerMessage onClose={onClose}>
        <EmptyState
          title="Couldn't load stories"
          message={errorMessage(stories.error)}
          action={
            <Button variant="secondary" onClick={() => void stories.refetch()}>
              Retry
            </Button>
          }
        />
      </ViewerMessage>
    );
  } else if (!stories.data || stories.data.stories.length === 0) {
    content = (
      <ViewerMessage onClose={onClose}>
        <EmptyState
          icon={CircleDashed}
          title="No stories right now"
          message="Stories disappear after 24 hours."
        />
      </ViewerMessage>
    );
  } else {
    content = (
      <StoryPlayer
        key={username}
        data={stories.data}
        nextUser={adjacentTrayUsername(ordered, username, 1)}
        prevUser={adjacentTrayUsername(ordered, username, -1)}
        onUser={onUser}
        onClose={onClose}
      />
    );
  }

  return (
    <main id="main-content" className="story-viewer" aria-labelledby="story-viewer-title">
      <h1 id="story-viewer-title" className="visually-hidden">{`@${username}'s story`}</h1>
      {content}
    </main>
  );
}
