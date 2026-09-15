"use client";

import * as React from "react";

export interface HoverState {
  hover: boolean;
  active: boolean;
}

export interface HoverHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

/** Hover and press state for components that style both. */
export function useHover(): [HoverState, HoverHandlers] {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  return [
    { hover, active },
    {
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => {
        setHover(false);
        setActive(false);
      },
      onMouseDown: () => setActive(true),
      onMouseUp: () => setActive(false),
    },
  ];
}
