import React from "react";
export function useHover() {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  return [{ hover, active }, { onMouseEnter: () => setHover(true), onMouseLeave: () => { setHover(false); setActive(false); }, onMouseDown: () => setActive(true), onMouseUp: () => setActive(false) }];
}
