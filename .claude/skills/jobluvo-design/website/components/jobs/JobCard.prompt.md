JobCard: list view unit. Logo, title, company and location, match on the right, one meta line, up to three reasons with + and - markers, then Apply, Save, Skip.

```jsx
<JobCard company="Stripe" logo={url} title="Strategy and Operations Lead" location="New York" salary="USD 175k to 215k" ats="Greenhouse" posted="3 days ago" match={71} reasons={["Operations and strategy split like yours","- Lead title, not director"]} />
```

The match number is the only large type. Reasons are the honest part; always include at least one minus.
