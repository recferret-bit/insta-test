import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { useIsAuthenticated, useMe } from "../../state/session";
import { meAsTrayUser, splitTray, useStoryTrayQuery, type StoryTrayItemViewModel } from "../../state/stories";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";
import "./StoryTray.css";

export const CREATE_STORY_PATH = "/create/story";

function TrayUserLink({ item, label }: { item: StoryTrayItemViewModel; label: string }) {
  const seen = item.ringState === "seen";
  return (
    <Link
      to={item.href}
      className="story-tray__link"
      aria-label={`${label}, ${item.storyCountLabel}${seen ? ", seen" : ""}`}
      data-ring={item.ringState}
    >
      <Avatar src={item.user.avatarUrl} alt="" size={56} ring={item.ringState} />
      <span className="story-tray__name" aria-hidden="true">
        {label}
      </span>
    </Link>
  );
}

/**
 * Horizontal story tray (F-FE-09): the signed-in user first (with "+" to add a story), then followees with unseen
 * stories, then seen ones. Unseen stories get the gradient ring, seen ones a muted ring. Rendered on `HomePage` (w05).
 */
export function StoryTray() {
  const authenticated = useIsAuthenticated();
  const me = useMe();
  const tray = useStoryTrayQuery({ enabled: authenticated });
  if (!authenticated || !me) return null;

  const { own, others } = splitTray(tray.data ?? [], me.id);
  const meUser = meAsTrayUser(me);

  return (
    <nav className="story-tray" aria-label="Stories">
      <ul className="story-tray__list" aria-busy={tray.isPending || undefined}>
        <li className="story-tray__item story-tray__item--own">
          {own ? (
            <TrayUserLink item={own} label="Your story" />
          ) : (
            <Link to={CREATE_STORY_PATH} className="story-tray__link" aria-label="Add to your story">
              <Avatar src={meUser.avatarUrl} alt="" size={56} />
              <span className="story-tray__name" aria-hidden="true">
                Your story
              </span>
            </Link>
          )}
          {own ? (
            <Link to={CREATE_STORY_PATH} className="story-tray__add" aria-label="Add to your story">
              <Icon icon={Plus} size={14} strokeWidth={3} />
            </Link>
          ) : (
            <span className="story-tray__add" aria-hidden="true">
              <Icon icon={Plus} size={14} strokeWidth={3} />
            </span>
          )}
        </li>
        {tray.isPending
          ? [0, 1, 2, 3].map((i) => (
              <li key={i} className="story-tray__item" aria-hidden="true">
                <Skeleton circle width={62} height={62} />
              </li>
            ))
          : others.map((item) => (
              <li key={item.user.id} className="story-tray__item">
                <TrayUserLink item={item} label={item.user.username} />
              </li>
            ))}
      </ul>
    </nav>
  );
}
