Modal: 440px, 12px radius, 1px strong border, 32% scrim. Header with title and ×, body in muted 14px, footer with Cancel and one primary button.

```jsx
<Modal title="Pause Strategy director, US remote?" confirmLabel="Pause lane" onCancel={close} onConfirm={pause}>Applications already in progress will finish.</Modal>
```

Use for confirmations and single questions only. Anything longer is a screen.
