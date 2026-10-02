# Feature dependency graph (AD-2)

Features import each other only through the other feature's `index.ts`, and the graph must stay a DAG.
Add an edge here in the same change that adds the import. `eslint-plugin-boundaries` blocks deep imports;
this file is where reviewers check for cycles.

Features: `auth`, `account`, `platform`, `organizations`, `users`, `venues`, `events`, `ticket-types`,
`registrations`, `attendees`, `dashboard`, `reports`, `audit`, `theme`.

| Feature | May import (via `index.ts`) | Why |
| --- | --- | --- |
| `auth` | `theme` | The Auth card shows the icon-only `ThemeToggle` (Story 1.2). |

Known planned edges (from the architecture spine, not yet built):

- `organizations` → `users` (Org Administrator management reuses the users components, AD-6).
- `app/routes/event-workspace` imports tab pages from `events`, `ticket-types`, `registrations`, `attendees`
  (a layout in `app/`, not a feature edge).
