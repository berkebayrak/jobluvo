/** Bordered container with optional header. No shadow. */
export interface CardProps {
  title?: string;
  /** Right side of the header, usually a ghost Button */
  action?: React.ReactNode;
  /** false when the body is a list of rows that own their padding */
  padded?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Card(props: CardProps): JSX.Element;
