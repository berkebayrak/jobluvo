"use client";

import * as React from "react";
import { useHover } from "../useHover";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Pressed look for toggle groups */
  selected?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const SIZES = {
  sm: { h: "var(--control-sm)", px: 10, fs: "var(--text-xs)" },
  md: { h: "var(--control-md)", px: 14, fs: "var(--text-sm)" },
  lg: { h: "var(--control-lg)", px: 20, fs: "var(--text-base)" },
} as const;

/** The only action control. One primary per view. */
export function Button({
  variant = "secondary",
  size = "md",
  disabled = false,
  selected = false,
  children,
  style,
  ...rest
}: ButtonProps) {
  const [{ hover, active }, h] = useHover();
  const s = SIZES[size] || SIZES.md;

  let bg = "var(--surface-0)";
  let fg = "var(--fg)";
  let border = "var(--border-strong)";

  if (variant === "primary") {
    bg = hover || active ? "var(--accent-hover)" : "var(--accent)";
    fg = "var(--fg-inverse)";
    border = bg;
  } else if (variant === "secondary") {
    bg = active
      ? "var(--surface-2)"
      : hover || selected
        ? "var(--surface-1)"
        : "var(--surface-0)";
    if (selected) border = "var(--border-focus)";
  } else if (variant === "ghost") {
    border = "transparent";
    bg = active
      ? "var(--surface-2)"
      : hover || selected
        ? "var(--surface-1)"
        : "transparent";
    fg = hover || selected ? "var(--fg)" : "var(--fg-muted)";
  }

  if (disabled) {
    bg = variant === "primary" ? "var(--jl-grey-300)" : "var(--surface-1)";
    fg = variant === "primary" ? "var(--fg-inverse)" : "var(--fg-disabled)";
    border = variant === "ghost" ? "transparent" : "var(--border)";
  }

  return (
    <button
      disabled={disabled}
      {...h}
      {...rest}
      style={{
        height: s.h,
        padding: `0 ${s.px}px`,
        fontSize: s.fs,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-sm)",
        background: bg,
        color: fg,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "background var(--duration-fast) var(--ease)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
