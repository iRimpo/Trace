"use client";

import Pressable from "@/components/ui/Pressable";
import StateBlock from "./StateBlock";
import { AlertIcon } from "./icons";

interface Props {
  /** What failed, in the user's terms. */
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  bare?: boolean;
  className?: string;
}

/**
 * The failure state.
 *
 * `role="alert"` rather than colour alone — the old version was a red-tinted
 * strip whose only signal was the tint, which is nothing to a screen reader and
 * ambiguous to anyone who cannot separate red from brown.
 *
 * Retry is `ink`, not `danger`: the *error* is red, the way out of it is a
 * neutral commit. Colouring the escape hatch red says the button is the
 * dangerous thing.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  bare = false,
  className = "",
}: Props) {
  return (
    <StateBlock
      bare={bare}
      tone="danger"
      live="alert"
      icon={<AlertIcon />}
      title={title}
      body={message}
      className={className}
      action={
        onRetry ? (
          <Pressable variant="ink" size="md" onClick={onRetry}>
            {retryLabel}
          </Pressable>
        ) : undefined
      }
    />
  );
}

export default ErrorState;
