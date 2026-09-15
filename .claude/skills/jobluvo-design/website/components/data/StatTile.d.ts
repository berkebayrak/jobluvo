/** Number tile for the dashboard row. Place four inside one bordered container. */
export interface StatTileProps {
  label: string;
  value: string | number;
  /** One plain sentence of context under the number */
  note?: string;
  /** Drops the right divider on the last tile in a row */
  last?: boolean;
}
export function StatTile(props: StatTileProps): JSX.Element;
