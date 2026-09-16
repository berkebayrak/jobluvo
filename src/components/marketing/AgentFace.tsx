"use client";

import * as React from "react";

/**
 * Maya's and Daniel's portraits, as the delivered site carries them, with the
 * same fallback: if the image does not load, the initial shows on an ink
 * circle instead.
 */
export function AgentFace({
  src,
  alt,
  initial,
}: {
  src: string;
  alt: string;
  initial: string;
}) {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return (
      <span className="face ph" role="img" aria-label={alt}>
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote portraits, no loader configured
    <img className="face" src={src} alt={alt} onError={() => setFailed(true)} />
  );
}
