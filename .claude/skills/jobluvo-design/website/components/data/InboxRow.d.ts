/** Message list row with linked application status. */
export interface InboxRowProps {
  from: string;
  logo?: string;
  subject: string;
  preview?: string;
  when: string;
  /** Linked application status, shown as a small StatusTag */
  status?: string;
  unread?: boolean;
  selected?: boolean;
  onClick?: () => void;
}
export function InboxRow(props: InboxRowProps): JSX.Element;
