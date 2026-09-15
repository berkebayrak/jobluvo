StatusTag: the one way to show application state. Each state has a 10px glyph and a chrome tier. Solid black = needs you or offer. Black border = interviewing. Grey border = passive states. Dashed = ghosted. Muted red text = failed. Rejected is grey and quiet.

```jsx
<StatusTag status="needs" />
<StatusTag status="interviewing" />
<StatusTag status="ghosted" size="sm" />
```

Never colour a tag. Never add a second tag to a row; if two things are true, the tracker column is the truth.
