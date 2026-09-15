TopNav: 52px, JOBLUVO wordmark in 600 with .18em tracking, tabs with a 1px black underline for the active one, right cluster for density, usage and avatar.

```jsx
<TopNav tabs={["Dashboard","Jobs","Auto Apply","Tracker","Inbox"]} active="Jobs" onSelect={setTab} right={<Avatar/>} />
```

Tabs never scroll. Profile and Settings live behind the avatar, not in the tabs.
