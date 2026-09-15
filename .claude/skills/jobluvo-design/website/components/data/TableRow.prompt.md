TableRow: one grid row. Compact is 32px, regular 40px. Selected fills surface-2, hover surface-1. Header is 11px uppercase on surface-1.

```jsx
const cols = "minmax(0,2fr) minmax(0,1fr) 120px 72px";
<TableRow header columns={cols} cells={["Role","Company","Status","Match"]} />
<TableRow columns={cols} cells={["Director, Strategy","Datadog",<StatusTag status="interviewing"/>,"88%"]} onClick={...} />
```

Numbers right aligned with tabular figures. No zebra striping, no vertical lines.
