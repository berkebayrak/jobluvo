/** 28x16 switch. Black when on, outlined when off. */
export interface ToggleProps {
  on: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
  /** Renders a labelled row with the switch on the right */
  label?: string;
  description?: string;
}
export function Toggle(props: ToggleProps): JSX.Element;
