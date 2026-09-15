InboxRow: sender with logo, subject, then a small StatusTag and the preview. Unread is weight 500, not a dot. Selected gets a 2px black left edge.

```jsx
<InboxRow from="Datadog" logo={url} subject="Second round" preview="We would like to invite you" when="Yesterday" status="interviewing" unread selected />
```

No avatars for people. The company is the sender.
