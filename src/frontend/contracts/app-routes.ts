// SPA route contracts. Source: docs/specs/frontend/01-app-shell-and-routing.md (Route Table).
import type { EndpointKey } from "./api-routes.ts";

/** `public_only` → redirect logged-in users to "/"; `required` → redirect to /login?next=…. */
export type RouteAuth = "public_only" | "required" | "optional" | "none";

export type PageName =
  | "LoginPage"
  | "SignupPage"
  | "HomePage"
  | "ExplorePage"
  | "SearchPage"
  | "HashtagPage"
  | "CreatePostPage"
  | "CreateStoryPage"
  | "PostPage"
  | "ProfilePage"
  | "StoryViewerPage"
  | "NotificationsPage"
  | "EditProfilePage"
  | "NotFoundPage";

export type AppRouteDef = {
  /** React Router 6 path pattern. */
  pattern: string;
  page: PageName;
  auth: RouteAuth;
  /** Modal rendered over the page, if any. */
  modal?: "FollowListModal";
  /** API endpoints the route loads or mutates. */
  endpoints: readonly EndpointKey[];
};

export const APP_ROUTES = {
  login: { pattern: "/login", page: "LoginPage", auth: "public_only", endpoints: ["login"] },
  signup: { pattern: "/signup", page: "SignupPage", auth: "public_only", endpoints: ["signup"] },
  home: { pattern: "/", page: "HomePage", auth: "required", endpoints: ["getStoryTray", "getFeed"] },
  explore: { pattern: "/explore", page: "ExplorePage", auth: "optional", endpoints: ["getExplore"] },
  search: { pattern: "/search", page: "SearchPage", auth: "optional", endpoints: ["searchUsers", "searchHashtags"] },
  hashtag: { pattern: "/tags/:tag", page: "HashtagPage", auth: "optional", endpoints: ["listHashtagPosts"] },
  createPost: { pattern: "/create", page: "CreatePostPage", auth: "required", endpoints: ["uploadMedia", "createPost"] },
  createStory: { pattern: "/create/story", page: "CreateStoryPage", auth: "required", endpoints: ["uploadMedia", "createStory"] },
  post: {
    pattern: "/p/:postId",
    page: "PostPage",
    auth: "optional",
    endpoints: ["getPost", "listComments", "likePost", "unlikePost", "createComment", "deleteComment"],
  },
  profile: { pattern: "/u/:username", page: "ProfilePage", auth: "optional", endpoints: ["getUser", "listUserPosts"] },
  followers: {
    pattern: "/u/:username/followers",
    page: "ProfilePage",
    auth: "optional",
    modal: "FollowListModal",
    endpoints: ["listFollowers"],
  },
  following: {
    pattern: "/u/:username/following",
    page: "ProfilePage",
    auth: "optional",
    modal: "FollowListModal",
    endpoints: ["listFollowing"],
  },
  storyViewer: {
    pattern: "/stories/:username",
    page: "StoryViewerPage",
    auth: "optional",
    endpoints: ["listUserStories", "markStorySeen", "listStoryViewers"],
  },
  notifications: {
    pattern: "/notifications",
    page: "NotificationsPage",
    auth: "required",
    endpoints: ["listNotifications", "markNotificationsRead"],
  },
  editProfile: {
    pattern: "/settings/profile",
    page: "EditProfilePage",
    auth: "required",
    endpoints: ["getMe", "uploadMedia", "updateMe"],
  },
  notFound: { pattern: "*", page: "NotFoundPage", auth: "none", endpoints: [] },
} as const satisfies Record<string, AppRouteDef>;

export type AppRouteKey = keyof typeof APP_ROUTES;

const enc = encodeURIComponent;

/** Typed link builders; every dynamic segment is URI-encoded. */
export const paths = {
  login: (next?: string) => (next ? `/login?next=${enc(next)}` : "/login"),
  signup: () => "/signup",
  home: () => "/",
  explore: () => "/explore",
  search: (q?: string) => (q ? `/search?q=${enc(q)}` : "/search"),
  hashtag: (tag: string) => `/tags/${enc(tag)}`,
  createPost: () => "/create",
  createStory: () => "/create/story",
  post: (postId: string) => `/p/${enc(postId)}`,
  profile: (username: string) => `/u/${enc(username)}`,
  followers: (username: string) => `/u/${enc(username)}/followers`,
  following: (username: string) => `/u/${enc(username)}/following`,
  storyViewer: (username: string) => `/stories/${enc(username)}`,
  notifications: () => "/notifications",
  editProfile: () => "/settings/profile",
} as const;

export type GuardDecision = { kind: "allow" } | { kind: "redirect"; to: string };

/**
 * RequireAuth / PublicOnly decision. `currentPath` should include search + hash
 * so the user returns to the same place after login.
 */
export function resolveGuard(auth: RouteAuth, isAuthenticated: boolean, currentPath: string): GuardDecision {
  if (auth === "required" && !isAuthenticated) return { kind: "redirect", to: paths.login(currentPath) };
  if (auth === "public_only" && isAuthenticated) return { kind: "redirect", to: paths.home() };
  return { kind: "allow" };
}

/**
 * Sanitise a `?next=` value: only same-origin absolute paths are honoured
 * (blocks `//evil.com`, `https://…`, `/\evil`); anything else → "/".
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export type RouteMatch = { key: AppRouteKey; params: Record<string, string> };

// Ordered so static segments win over params (`/create/story` before anything generic).
const MATCH_ORDER: readonly AppRouteKey[] = (Object.keys(APP_ROUTES) as AppRouteKey[]).filter(
  (k) => k !== "notFound",
);

/** Match a pathname (no query/hash) against the route table; falls back to `notFound`. */
export function matchAppRoute(pathname: string): RouteMatch {
  const segs = splitPath(pathname);
  for (const key of MATCH_ORDER) {
    const pattern = splitPath(APP_ROUTES[key].pattern);
    if (pattern.length !== segs.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i]!;
      const s = segs[i]!;
      if (p.startsWith(":")) {
        try {
          params[p.slice(1)] = decodeURIComponent(s);
        } catch {
          ok = false;
          break;
        }
      } else if (p !== s) {
        ok = false;
        break;
      }
    }
    if (ok) return { key, params };
  }
  return { key: "notFound", params: {} };
}

function splitPath(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}
