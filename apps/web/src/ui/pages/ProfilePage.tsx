import { CircleUser } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

export type ProfilePageProps = {
  /** Set by `/u/:username/followers|following`: render the profile with the `FollowListModal` (w03) open. */
  followList?: "followers" | "following";
};

/** `/u/:username` (auth optional) — F-FE-06; implemented by w05 (`GET /users/{username}`, `GET /users/{username}/posts`). */
export function ProfilePage({ followList }: ProfilePageProps) {
  const { username = "" } = useParams();
  useDocumentTitle(`@${username}`);
  return (
    <PagePlaceholder
      title={`@${username}`}
      icon={CircleUser}
      width="wide"
      message={
        followList
          ? `${followList === "followers" ? "Followers" : "Following"} will appear here.`
          : "Profile details and posts will appear here."
      }
      action={
        <span>
          <Link to={`/u/${encodeURIComponent(username)}/followers`}>Followers</Link> ·{" "}
          <Link to={`/u/${encodeURIComponent(username)}/following`}>Following</Link>
        </span>
      }
    />
  );
}
