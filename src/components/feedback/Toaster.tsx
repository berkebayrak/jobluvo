"use client";

import { Toaster as SonnerToaster, toast } from "sonner";
import { ToastPill, type ToastProps } from "./Toast";

/**
 * Toast behaviour only: queueing, the 3 second timer, the live region and
 * dismissal. sonner's own chrome is switched off entirely with
 * unstyled/toast.custom, so what renders is ToastPill and nothing else.
 *
 * visibleToasts is 1 because the system never stacks more than one toast.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      duration={3000}
      visibleToasts={1}
      offset={24}
      gap={0}
      toastOptions={{ unstyled: true, style: { background: "transparent" } }}
    />
  );
}

/** Show one toast. Returns the sonner id so callers can dismiss it early. */
export function showToast({ text, actionLabel, onAction }: ToastProps) {
  return toast.custom(
    (id) => (
      <ToastPill
        text={text}
        actionLabel={actionLabel}
        onAction={() => {
          onAction?.();
          toast.dismiss(id);
        }}
      />
    ),
    { duration: 3000 },
  );
}
