"use client";

import type { ReactNode } from "react";
import StateBlock from "./StateBlock";

interface Props {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  /** An illustration, when the moment deserves one. Falls back to a glyph plate. */
  art?: ReactNode;
  icon?: ReactNode;
  bare?: boolean;
  className?: string;
}

/**
 * "There is nothing here yet" — the first screen a new user sees, so it is the
 * one state in this set that carries an illustration rather than a glyph.
 *
 * No idle pulse on the call to action. The `Pressable` chunk already reads as
 * pressable, and a looping scale on the only button on screen competes with the
 * press feedback the button gives when you actually hit it.
 */
export function EmptyState({ title, body, action, art, icon, bare = false, className = "" }: Props) {
  return (
    <StateBlock
      bare={bare}
      title={title}
      body={body}
      action={action}
      art={art}
      icon={icon}
      className={className}
    />
  );
}

export default EmptyState;
