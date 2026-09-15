Card: 1px grey-200 border, 8px radius, white. Optional header row with title and one action. Rows inside use padded={false}.

```jsx
<Card title="Top matches" action={<Button variant="ghost" size="sm">All 42</Button>} padded={false}>...rows</Card>
```

Cards never nest. Sunken areas inside a card use surface-1.
