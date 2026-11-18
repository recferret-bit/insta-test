import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Avatar, type AvatarRing, type AvatarSize } from "./Avatar";
import "./UserRow.css";

export type UserRowUser = {
  username: string;
  fullName: string;
  avatarUrl: string;
  profilePath: string;
};

export type UserRowProps = {
  user: UserRowUser;
  /** Second line; defaults to the full name. */
  subtitle?: ReactNode;
  /** Trailing action, e.g. a follow button. */
  action?: ReactNode;
  avatarSize?: AvatarSize;
  ring?: AvatarRing;
  onNavigate?: () => void;
};

/** Avatar + username (link to profile) + subtitle + optional trailing action. */
export function UserRow({
  user,
  subtitle,
  action,
  avatarSize = 44,
  ring = "none",
  onNavigate,
}: UserRowProps) {
  const secondLine = subtitle ?? user.fullName;
  return (
    <div className="user-row">
      <Link to={user.profilePath} className="user-row__link" onClick={onNavigate}>
        <Avatar src={user.avatarUrl} alt="" size={avatarSize} ring={ring} />
        <span className="user-row__text">
          <span className="user-row__username">{user.username}</span>
          {secondLine ? <span className="user-row__subtitle">{secondLine}</span> : null}
        </span>
      </Link>
      {action ? <div className="user-row__action">{action}</div> : null}
    </div>
  );
}
