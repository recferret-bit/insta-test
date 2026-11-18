import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { toMeVM } from "../../state/mappers/user";
import { toPostVM, type PostViewModel } from "../../state/mappers/post";
import { createQueryClient } from "../../state/queryClient";
import { queryKeys } from "../../state/query-keys";
import { clearSession, setSession } from "../../state/session";
import { hexId, me, media, NOW, post, userSummary } from "../../test/fixtures";
import { CaptionText } from "./CaptionText";
import { PostCard } from "./PostCard";

const ID = hexId("pst", 1);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

let client: ReturnType<typeof createQueryClient>;

function renderCard(dto = post({ like_count: 3 }), viewerId: string | null = null) {
  client = createQueryClient();
  const vm = toPostVM(dto, { viewerId, now: NOW });
  client.setQueryData(queryKeys.post(ID), vm);
  const router = createMemoryRouter(
    [
      { path: "/", element: <Live /> },
      { path: "*", element: <Where /> },
    ],
    { initialEntries: ["/"], future: { v7_relativeSplatPath: true } },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
  return { router };
}

/** Subscribes to `["post", ID]` so optimistic updates re-render the card. */
function Live() {
  const { data } = useQuery({
    queryKey: queryKeys.post(ID),
    queryFn: () => client.getQueryData<PostViewModel>(queryKeys.post(ID)) as PostViewModel,
    staleTime: Infinity,
  });
  return data ? <PostCard post={data} /> : null;
}

const FUTURE = "2099-01-01T00:00:00.000Z";

describe("PostCard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn((_url: string, init: RequestInit) =>
      Promise.resolve(
        json(200, { post_id: ID, liked: init.method === "PUT", like_count: init.method === "PUT" ? 4 : 3 }),
      ),
    );
    configureTestHttp(fetchMock as unknown as typeof fetch);
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me({ id: hexId("usr", 2), username: "bob" })) });
  });
  afterEach(() => clearSession());

  it("renders header, linkified caption, counts and the comments link", () => {
    renderCard(post({ like_count: 3, comment_count: 12 }));
    const card = screen.getByRole("article", { name: "Post by @alice" });
    expect(within(card).getAllByRole("link", { name: "alice" })[0]?.getAttribute("href")).toBe("/u/alice");
    expect(within(card).getByRole("link", { name: "#Beach" }).getAttribute("href")).toBe("/tags/beach");
    expect(within(card).getByRole("link", { name: "@bob" }).getAttribute("href")).toBe("/u/bob");
    expect(within(card).getByText("3 likes")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "View all 12 comments" }).getAttribute("href")).toBe(
      `/p/${ID}`,
    );
    expect(within(card).getByRole("img", { name: "Sunset at the #Beach with @bob" })).toBeTruthy();
    // Not the author: no menu.
    expect(within(card).queryByRole("button", { name: "More options" })).toBeNull();
  });

  it("toggles like optimistically with aria-pressed", async () => {
    renderCard();
    const like = screen.getByRole("button", { name: "Like" });
    expect(like.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(like);
    const unlike = await screen.findByRole("button", { name: "Unlike" });
    expect(unlike.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("4 likes")).toBeTruthy();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" });
  });

  it("double-click on media likes but never unlikes", async () => {
    renderCard(post({ viewer_has_liked: true, like_count: 4 }));
    fireEvent.doubleClick(screen.getByTestId("carousel-viewport"));
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Unlike" })).toBeTruthy();
  });

  it("double-click on unliked media sends one like", async () => {
    renderCard();
    fireEvent.doubleClick(screen.getByTestId("carousel-viewport"));
    await screen.findByRole("button", { name: "Unlike" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends anonymous visitors to log in instead of liking", async () => {
    clearSession();
    const { router } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the author menu on own posts", () => {
    renderCard(post({ author: userSummary({ id: hexId("usr", 2), username: "bob" }) }), hexId("usr", 2));
    expect(screen.getByRole("button", { name: "More options" })).toBeTruthy();
  });

  it("marks multi-media posts as a carousel with slide labels", () => {
    renderCard(post({ media: [media(), media({ id: hexId("med", 2) })] }));
    const region = screen.getByRole("region", { name: "Media of post by @alice" });
    expect(region.getAttribute("aria-roledescription")).toBe("carousel");
    expect(within(region).getByRole("group", { name: "1 of 2" })).toBeTruthy();
  });
});

describe("CaptionText", () => {
  function renderCaption(caption: string, collapsible = false) {
    const vm = toPostVM(post({ caption }), { viewerId: null, now: NOW });
    const router = createMemoryRouter(
      [{ path: "/", element: <CaptionText tokens={vm.captionTokens} collapsible={collapsible} /> }],
      { future: { v7_relativeSplatPath: true } },
    );
    render(<RouterProvider router={router} future={{ v7_startTransition: true }} />);
  }

  it("keeps plain text and email-like strings unlinked", () => {
    renderCaption("mail me at a@b.c or a#b");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("mail me at a@b.c or a#b")).toBeTruthy();
  });

  it("collapses long captions behind a 'more' button", () => {
    renderCaption("x".repeat(200), true);
    fireEvent.click(screen.getByRole("button", { name: "more" }));
    expect(screen.queryByRole("button", { name: "more" })).toBeNull();
  });
});
