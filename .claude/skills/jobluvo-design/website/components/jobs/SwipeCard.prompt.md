SwipeCard: one job, everything needed to decide. Match ring in the corner, 22px title, two fact tiles, reasons, footnote. Stack two blank cards behind it at .96 and .92 scale.

```jsx
<SwipeCard company="Datadog" logo={url} title="Director, Strategy" location="New York or remote" posted="2 h ago" salary="USD 190k to 240k" ats="Greenhouse" match={88} reasons={["Director title","- Wants SaaS pricing exposure"]} footnote="Resume Strategy_v3 will be tailored for this role." stamp={null} />
```

Setting stamp to "apply" or "skip" throws the card off screen in 200ms. Reset it and swap the job after.
