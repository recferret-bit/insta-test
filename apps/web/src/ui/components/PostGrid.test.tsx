import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { toPostVM } from "../../state/mappers/post";
import { hexId, media, NOW, post } from "../../test/fixtures";
import { PostGrid, tileLabel } from "./PostGrid";

const vm = (overrides: Parameters<typeof post>[0]) => toPostVM(post(overrides), { viewerId: null, now: NOW });

function renderGrid(ui: JSX.Element) {
  const router = createMemoryRouter([{ path: "/", element: ui }], { future: { v7_relativeSplatPath: true } });
  render(<RouterProvider router={router} future={{ v7_startTransition: true }} />);
}

describe("PostGrid", () => {
  const photo = vm({ id: hexId("pst", 1), like_count: 1234, comment_count: 1 });
  const video = vm({
    id: hexId("pst", 2),
    media: [media({ kind: "video", mime_type: "video/mp4", duration_ms: 3000 })],
  });
  const multi = vm({ id: hexId("pst", 3), media: [media(), media({ id: hexId("med", 2) })] });

  it("renders linked tiles with badges and hover counts", () => {
    renderGrid(<PostGrid posts={[photo, video, multi]} />);
    const grid = screen.getByRole("list", { name: "Posts" });
    const links = within(grid).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([photo.path, video.path, multi.path]);
    expect(links[0]?.querySelector("[data-badge]")).toBeNull();
    expect(links[1]?.querySelector("[data-badge]")?.getAttribute("data-badge")).toBe("video");
    expect(links[2]?.querySelector("[data-badge]")?.getAttribute("data-badge")).toBe("multi");
    expect(links[0]?.textContent).toContain("1.2K");
  });

  it("gives tiles an accessible label with counts", () => {
    expect(tileLabel(photo)).toBe("Photo: Sunset at the #Beach with @bob. 1,234 likes, 1 comment");
    expect(tileLabel(multi)).toMatch(/^Photo, 2 items: /);
    expect(tileLabel(video)).toMatch(/^Video: .*0 comments$/);
  });

  it("appends skeleton tiles while loading", () => {
    renderGrid(<PostGrid posts={[photo]} loadingTiles={3} />);
    const grid = screen.getByRole("list", { name: "Posts" });
    expect(grid.getAttribute("aria-busy")).toBe("true");
    expect(grid.querySelectorAll("li")).toHaveLength(4);
  });
});
