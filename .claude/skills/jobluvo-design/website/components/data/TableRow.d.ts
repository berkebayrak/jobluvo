/** Grid row for data tables. Header rows are uppercase 11px on surface-1. */
export interface TableRowProps {
  /** CSS grid-template-columns shared by every row in the table */
  columns: string;
  cells: React.ReactNode[];
  header?: boolean;
  selected?: boolean;
  density?: "compact" | "regular";
  onClick?: () => void;
}
export function TableRow(props: TableRowProps): JSX.Element;
