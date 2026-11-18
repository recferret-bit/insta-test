/**
 * Route table (F-FE-01) — docs/specs/frontend/01-app-shell-and-routing.md#route-table.
 * Pages come from `ui/pages/index.ts`; guards: `RequireAuth` → `/login?next=…`, `PublicOnly` → `/` (or safe `next`).
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router-dom";

import { AppShell } from "./ui/layout/AppShell";
import { PublicOnly } from "./ui/layout/PublicOnly";
import { RequireAuth } from "./ui/layout/RequireAuth";
import { RootLayout } from "./ui/layout/RootLayout";
import { RouteErrorBoundary } from "./ui/layout/RouteErrorBoundary";
import {
  CreatePostPage,
  CreateStoryPage,
  EditProfilePage,
  ExplorePage,
  HashtagPage,
  HomePage,
  LoginPage,
  NotFoundPage,
  NotificationsPage,
  PostPage,
  ProfilePage,
  SearchPage,
  SignupPage,
  StoryViewerPage,
} from "./ui/pages";

const errorElement = <RouteErrorBoundary />;

/** Leaf route with its own error boundary, so a failing page keeps the shell usable. */
function page(path: string | undefined, element: JSX.Element): RouteObject {
  return path === undefined ? { index: true, element, errorElement } : { path, element, errorElement };
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement,
    children: [
      {
        element: <PublicOnly />,
        children: [page("/login", <LoginPage />), page("/signup", <SignupPage />)],
      },
      // Full-screen overlay outside the shell.
      page("/stories/:username", <StoryViewerPage />),
      {
        element: <AppShell />,
        errorElement,
        children: [
          {
            element: <RequireAuth />,
            children: [
              page("/", <HomePage />),
              page("/create", <CreatePostPage />),
              page("/create/story", <CreateStoryPage />),
              page("/notifications", <NotificationsPage />),
              page("/settings/profile", <EditProfilePage />),
            ],
          },
          page("/explore", <ExplorePage />),
          page("/search", <SearchPage />),
          page("/tags/:tag", <HashtagPage />),
          page("/p/:postId", <PostPage />),
          page("/u/:username", <ProfilePage />),
          page("/u/:username/followers", <ProfilePage followList="followers" />),
          page("/u/:username/following", <ProfilePage followList="following" />),
          page("*", <NotFoundPage />),
        ],
      },
    ],
  },
];

/** Opt into React Router v7 behaviour now so the later upgrade is a no-op. */
export const ROUTER_FUTURE = {
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
} as const;

export type AppRouter = ReturnType<typeof createBrowserRouter>;

export function createAppRouter(): AppRouter {
  return createBrowserRouter(routes, { future: ROUTER_FUTURE });
}

export function App({ router, queryClient }: { router: AppRouter; queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  );
}
