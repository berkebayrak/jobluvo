Button: the only action control. Primary is black, secondary is white with a strong border, ghost has no border. One primary per view.

```jsx
<Button variant="primary">Apply</Button>
<Button>Save</Button>
<Button variant="ghost" size="sm">Skip</Button>
```

Sizes sm 28px, md 36px, lg 44px. Hover darkens one step (primary) or fills surface-1 (secondary, ghost). Disabled uses grey-300 fill or grey-400 text. Never add shadows or icons on the right.
