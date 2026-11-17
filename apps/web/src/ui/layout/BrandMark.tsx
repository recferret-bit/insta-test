import { useId } from "react";
import { Link } from "react-router-dom";

import { APP_NAME } from "./useDocumentTitle";

/** Original "Insta-test" mark: gradient rounded square with a lens ring (same artwork as /favicon.svg). */
export function BrandLogo({ size = 28 }: { size?: number }) {
  const gradientId = `brand-gradient-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f59e0b" />
          <stop offset="0.5" stopColor="#ec4899" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill={`url(#${gradientId})`} />
      <circle cx="32" cy="32" r="12" fill="none" stroke="#fff" strokeWidth="5" />
      <circle cx="46" cy="18" r="3.5" fill="#fff" />
    </svg>
  );
}

export function BrandMark({ showName = true }: { showName?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label={`${APP_NAME} home`}>
      <BrandLogo />
      {showName ? (
        <span className="brand__name" aria-hidden="true">
          {APP_NAME}
        </span>
      ) : null}
    </Link>
  );
}
