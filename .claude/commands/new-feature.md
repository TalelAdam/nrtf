---
description: Scaffold a full vertical slice (backend module + frontend page + types) for a new feature
argument-hint: feature-name (kebab-case)
---

Create a new feature called `$ARGUMENTS` with:

1. Use the **backend-engineer** agent to scaffold `apps/backend/src/modules/$ARGUMENTS/` per the `nestjs-module` skill (controller + service + DTOs + entity + tests + module wiring in app.module.ts).
2. Use the **frontend-designer** agent to scaffold `apps/frontend/src/app/$ARGUMENTS/page.tsx` and a matching widget under `components/widgets/` per the `nextjs-component` skill.
3. Add shared types to `packages/types/src/$ARGUMENTS.ts`.
4. Add the API client function to `apps/frontend/src/lib/api/$ARGUMENTS.ts`.
5. Confirm Swagger UI shows the new endpoints at http://localhost:3000/docs.

Report what was created and any decisions made.
