/** Tracker card. Column position is the status, so no tag inside. */
export interface KanbanCardProps {
  company: string;
  /** Logo.dev image URL */
  logo?: string;
  title: string;
  match?: number;
  /** Last event, one short clause */
  event?: string;
  date?: string;
}
export function KanbanCard(props: KanbanCardProps): JSX.Element;
