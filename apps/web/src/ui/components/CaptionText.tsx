import { useState } from "react";
import { Link } from "react-router-dom";

import type { CaptionToken } from "../../state/mappers/post";
import "./CaptionText.css";

export type CaptionTextProps = {
  tokens: readonly CaptionToken[];
  /** Author shown in bold before the caption (links to the profile). */
  author?: { username: string; profilePath: string };
  /** Clamp long captions to two lines with a "more" button. */
  collapsible?: boolean;
  className?: string;
};

/** Characters after which a collapsible caption shows "more". */
export const CAPTION_COLLAPSE_CHARS = 125;

function captionLength(tokens: readonly CaptionToken[]): number {
  return tokens.reduce((n, t) => n + t.text.length, 0);
}

function hasLineBreaks(tokens: readonly CaptionToken[]): boolean {
  return tokens.some((t) => t.type === "text" && t.text.includes("\n"));
}

/** Caption with linkified `#tags` (→ `/tags/:tag`) and `@mentions` (→ `/u/:username`, display only). */
export function CaptionText({ tokens, author, collapsible = false, className }: CaptionTextProps) {
  const long = collapsible && (captionLength(tokens) > CAPTION_COLLAPSE_CHARS || hasLineBreaks(tokens));
  const [expanded, setExpanded] = useState(false);
  const clamped = long && !expanded;
  if (tokens.length === 0 && !author) return null;
  return (
    <p className={["caption", clamped && "caption--clamped", className].filter(Boolean).join(" ")}>
      {author ? (
        <>
          <Link className="caption__author" to={author.profilePath}>
            {author.username}
          </Link>{" "}
        </>
      ) : null}
      <span className="caption__text">
        {tokens.map((token, index) => {
          if (token.type === "text") return <span key={index}>{token.text}</span>;
          return (
            <Link
              key={index}
              to={token.href}
              className={`caption__link caption__link--${token.type}`}
              data-token={token.type}
            >
              {token.text}
            </Link>
          );
        })}
      </span>
      {clamped ? (
        <button type="button" className="caption__more" onClick={() => setExpanded(true)}>
          more
        </button>
      ) : null}
    </p>
  );
}
