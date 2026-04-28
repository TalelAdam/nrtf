# @nrtf/frontend

Next.js 14 (App Router) dashboard for NRTF.

## Layout

```
src/
├── app/                 # routes (App Router)
├── components/
│   ├── ui/              # shadcn/ui primitives
│   ├── charts/          # chart wrappers (Recharts, Plotly)
│   ├── widgets/         # composed energy widgets
│   └── layouts/         # app shell, header, sidebar
├── hooks/
├── lib/
│   ├── api/             # typed fetchers
│   ├── utils/           # cn(), formatters
│   └── constants/
├── store/               # Zustand stores
├── styles/              # globals.css, fonts
└── types/
public/
```

## Setup

```bash
cp .env.example .env.local
pnpm install
pnpm dev   # http://localhost:3001

# Add a shadcn primitive on demand:
pnpm dlx shadcn-ui@latest add button card dialog
```

## Component pattern

See `.claude/skills/nextjs-component/SKILL.md`.

## Energy dashboard guide

See `.claude/skills/energy-dashboard/SKILL.md` for chart selection, units, color semantics.
