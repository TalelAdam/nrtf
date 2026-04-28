---
name: nextjs-component
description: Use when creating a Next.js 14 App Router page, layout, or React component. Trigger on "make a page for X", "build a component for Y", "add a widget", "create a dashboard view".
---

# Next.js 14 App Router Component Scaffold

## Folder & file decisions

| Goal | File location |
|------|---------------|
| New top-level page | `apps/frontend/src/app/<route>/page.tsx` |
| Page-level layout | `apps/frontend/src/app/<route>/layout.tsx` |
| Loading skeleton | `apps/frontend/src/app/<route>/loading.tsx` |
| Error boundary | `apps/frontend/src/app/<route>/error.tsx` |
| Reusable UI primitive | `apps/frontend/src/components/ui/<name>.tsx` (shadcn pattern) |
| Energy chart wrapper | `apps/frontend/src/components/charts/<name>.tsx` |
| Composed widget | `apps/frontend/src/components/widgets/<name>.tsx` |
| App shell / nav | `apps/frontend/src/components/layouts/<name>.tsx` |
| Data fetching | `apps/frontend/src/lib/api/<resource>.ts` |
| Custom hook | `apps/frontend/src/hooks/use-<name>.ts` |
| Shared types | `packages/types/src/<domain>.ts` |

## Server vs client components

- **Default to server.** Server Components fetch data directly via `lib/api/*` (which uses `fetch` with `next: { revalidate: 60 }`).
- Mark `"use client"` only when the component uses: `useState`, `useEffect`, event handlers, browser APIs, third-party libs that touch DOM.
- Charts (Recharts, Plotly) and form inputs are always client components — wrap them, don't mark whole pages.

## Component template (client interactive)

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { fetchReadings } from "@/lib/api/readings";

interface LivePowerCardProps {
  deviceId: string;
}

export function LivePowerCard({ deviceId }: LivePowerCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["readings", deviceId],
    queryFn: () => fetchReadings(deviceId),
    refetchInterval: 5_000,
  });

  if (isLoading) return <div>Loading…</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Power · {deviceId}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-mono">{data?.powerWatts.toFixed(1)} W</p>
      </CardContent>
    </Card>
  );
}
```

## Component template (server, data-fetching page)

```tsx
import { Suspense } from "react";
import { LivePowerCard } from "@/components/widgets/live-power-card";

export default async function DevicePage({
  params,
}: { params: { id: string } }) {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Device {params.id}</h1>
      <Suspense fallback={<div>Loading…</div>}>
        <LivePowerCard deviceId={params.id} />
      </Suspense>
    </main>
  );
}
```

## Naming & import rules

- Component file: `kebab-case.tsx`. Component name: `PascalCase`.
- Default export only for `page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx`. Named export for everything else.
- Imports use the `@/` alias (configured in `tsconfig.json`).
- Group imports: external → internal → types → styles. Alphabetize within groups.

## Tailwind discipline

- Compose utility classes; extract repeated patterns into `cn()` (clsx + tailwind-merge) helpers.
- Use `cn` from `lib/utils.ts` to merge variant classes.
- For variants, use `class-variance-authority` (CVA) — same pattern as shadcn/ui.

## After creating a component

1. If it consumes API data, also add the matching function to `lib/api/<resource>.ts`.
2. If new types are needed, add them to `packages/types/src/` first.
3. Add a Storybook entry if Storybook is set up (post-hackathon).
4. Verify it renders at 375px (mobile) and 1440px (desktop).

## Shortcuts

- For shadcn primitives: `pnpm dlx shadcn-ui@latest add <name>` — DO NOT hand-write Card, Button, Dialog, Sheet, etc.
- For icons: import from `lucide-react`.
- For dates: use `date-fns`, not Moment.
- For charts: prefer Recharts; only reach for Plotly when Recharts can't (Sankey, treemap, geo).
