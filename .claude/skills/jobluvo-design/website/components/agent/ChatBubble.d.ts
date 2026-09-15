/** Agent panel message. Same type as the product, no avatars in the thread. */
export interface ChatBubbleProps {
  /** user bubbles are filled grey on the right, agent bubbles outlined on the left */
  from: "user" | "agent";
  children: React.ReactNode;
}
export function ChatBubble(props: ChatBubbleProps): JSX.Element;
