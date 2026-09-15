/** Bottom centre, black, one line, optional Undo. Auto dismiss after ~3s. */
export interface ToastProps {
  text: string;
  /** Usually "Undo" */
  actionLabel?: string;
  onAction?: () => void;
}
export function Toast(props: ToastProps): JSX.Element;
