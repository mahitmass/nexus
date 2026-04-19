apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout — providers only
│   │   ├── page.tsx                    # Redirect → /dashboard
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   ├── sign-in/page.tsx
│   │   │   └── sign-up/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx              # Dashboard shell
│   │       ├── dashboard/
│   │       │   └── page.tsx            # ← THEME ENTRY POINT
│   │       ├── records/
│   │       │   ├── page.tsx            # List view (records = agnostic name)
│   │       │   └── [id]/page.tsx
│   │       ├── analytics/
│   │       │   └── page.tsx
│   │       ├── ai-assistant/
│   │       │   └── page.tsx
│   │       └── settings/
│   │           └── page.tsx
│   │
│   ├── components/                     # App-level composite components
│   │   ├── providers/
│   │   │   ├── QueryProvider.tsx       # React Query + tRPC
│   │   │   ├── AuthProvider.tsx        # Clerk or NextAuth
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── index.tsx              # Combined root provider
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopNav.tsx
│   │   │   └── MobileNav.tsx
│   │   └── dashboard/
│   │       ├── KPICard.tsx            # Agnostic metric card
│   │       ├── DataTable.tsx          # Agnostic data table
│   │       ├── ChartPanel.tsx         # Recharts wrapper
│   │       └── AIPanel.tsx            # AI chat sidebar
│   │
│   ├── lib/
│   │   ├── trpc/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── apollo/
│   │   │   └── client.ts
│   │   ├── auth/
│   │   │   └── config.ts              # NextAuth / Clerk config
│   │   ├── db/
│   │   │   └── index.ts               # Prisma singleton
│   │   └── utils.ts
│   │
│   ├── hooks/
│   │   ├── useData.ts                 # Generic data fetching hook
│   │   ├── useRealtime.ts             # Socket.io hook
│   │   └── useAI.ts                  # AI streaming hook
│   │
│   ├── store/
│   │   ├── uiStore.ts                 # Zustand — sidebar, theme
│   │   ├── dataStore.ts               # Zustand — selected records
│   │   └── aiStore.ts                 # Zustand — AI chat state
│   │
│   └── types/
│       └── index.ts                   # Re-export from @nexus/types
│
├── public/
│   ├── manifest.json                  # PWA manifest
│   ├── sw.js                          # Service worker (generated)
│   └── icons/                         # PWA icons
│
├── prisma/
│   ├── schema.prisma                  # ← CHANGE MODELS PER THEME
│   └── migrations/
│
├── .env.example
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── jest.config.ts
├── playwright.config.ts
├── cypress.config.ts
└── .storybook/
    ├── main.ts
    └── preview.tsx
