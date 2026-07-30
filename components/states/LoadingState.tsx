"use client";

import StateBlock from "./StateBlock";
import { Spinner } from "./icons";

interface Props {
  message?: string;
  /** Second line — what is happening, when the wait is long enough to explain. */
  detail?: string;
  bare?: boolean;
  className?: string;
}

/**
 * The waiting state. Same 64px plate and same bold heading as the empty and
 * error states — only the glyph and the tone change, so a page moving between
 * them does not appear to change layout.
 *
 * Two counter-rotating rings were the old spinner. One ring is enough: it is a
 * progress indicator, not a feature.
 */
export function LoadingState({ message = "Loading…", detail, bare = true, className = "" }: Props) {
  return (
    <StateBlock
      bare={bare}
      live="status"
      icon={<Spinner />}
      title={message}
      body={detail}
      className={className}
    />
  );
}

export default LoadingState;
