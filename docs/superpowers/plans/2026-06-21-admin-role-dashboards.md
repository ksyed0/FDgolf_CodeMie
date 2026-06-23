# Admin Role Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `system_admin` users a global management UI (tournaments list, venue/course/club management, admin assignments) and `tournament_admin` users a scoped sidebar and roster page limited to their assigned tournament.

**Architecture:** Single `/admin/` layout extended to read the player's role and tournament assignments, set an `x-active-tournament` cookie, and pass `{ role, activeTournament }` to a role-aware `AdminSidebar`. All tournament-scoped pages read the cookie instead of querying for the most-recent tournament. New pages: `/admin/tournaments` (system admin list), `/admin/roster` (per-tournament player enrollment), `/admin/select-tournament` (multi-assignment picker).

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (server client + `@supabase/ssr`), Tailwind CSS, `next/headers` cookies API, Server Actions.

## Global Constraints

- All admin pages live under `src/app/(admin)/admin/`
- Server components use `createClient()` from `@/lib/supabase/server`; client components use `createClient()` from `@/lib/supabase/client`
- Cookie name: `x-active-tournament` (httpOnly, sameSite: 'lax', path: '/')
- `PlayerRole` type is `'player' | 'system_admin' | 'tournament_admin' | 'tournament_organizer'` (defined in `src/lib/types.ts`)
- `TournamentAdminAssignment` interface already in `src/lib/types.ts`
- Sidebar brand label is `FDGOLF-CM` (not `FDGOLF`)
- No new npm dependencies
- Run `npm run type-check` and `npm run test:ci` after each task; both must pass before committing
- Branch: `feature/admin-role-dashboards` off `develop`
- **Design tokens** (match existing pages exactly):
  - Colors: `#15241c` (dark text), `#1a472a` (primary green), `#6b7a70` (secondary text), `#eef2ea` (light green bg), `#e2e8df` (border), `#90a094` (muted label), `#a8513f` (danger text), `#f7ece9` (danger bg)
  - Cards: `bg-white rounded-2xl border border-[#e2e8df] p-5`
  - Icon tiles: 52×52px `rounded-[13px] bg-[#eef2ea]` with emoji at `fontSize: 22`
  - Buttons — primary: `rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#1a472a] text-white`; secondary/cancel: `rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#15241c]`; delete: `rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]`
  - Inline confirm-delete: `"Delete? Yes / No"` text pattern in the card (no modal)
  - All client page components use `<AdminTopBar eyebrow="UPPERCASE LABEL" title="Page Title" />` from `@/components/admin-top-bar` for the header
  - Feedback via `toast.success()` / `toast.error()` from `sonner` — no `setError` state for network errors
  - Form fields: `<Input>` from `@/components/ui/input` and `<Label>` from `@/components/ui/label`
  - Add form placement: right-side `w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6` panel
  - Edit form placement: inline below the card being edited
  - Content area padding: `px-7 py-6`
  - Typography: card titles `font-semibold text-[17px] text-[#15241c]`, subtitles `text-[13px] text-[#6b7a70]`, form section titles `font-barlow font-bold text-[18px] text-[#15241c]`

---

## File Map

**Create:**
- `src/lib/active-tournament.ts` — read/write `x-active-tournament` cookie; server-side only
- `src/lib/actions/set-active-tournament.ts` — Server Action to update the cookie (used by sidebar switcher and picker page)
- `src/app/(admin)/admin/select-tournament/page.tsx` — tournament picker for multi-assignment admins
- `src/app/(admin)/admin/tournaments/page.tsx` — global tournament list (system admin)
- `src/app/(admin)/admin/tournaments/tournaments-list.tsx` — client component: card list + inline create form
- `src/app/(admin)/admin/roster/page.tsx` — tournament-scoped player roster (both roles)
- `src/app/(admin)/admin/roster/roster-manager.tsx` — client component: list + add existing + create new
- `src/app/(admin)/admin/tournament/tournament-admins.tsx` — client component: add/remove tournament admins
- `src/__tests__/active-tournament.test.ts` — unit tests for cookie helper

**Modify:**
- `src/app/(admin)/layout.tsx` — fetch role + assignments; set cookie; redirect to picker
- `src/components/admin-sidebar.tsx` — role-aware two-section nav; tournament switcher for system_admin
- `src/app/(admin)/admin/tournament/page.tsx` — import and render `TournamentAdmins`
- `src/app/(admin)/admin/teams/page.tsx` — read tournamentId from cookie instead of most-recent query
- `src/app/(admin)/admin/scores/page.tsx` — same fix
- `src/app/(admin)/admin/sponsors/page.tsx` — same fix
- `src/app/(admin)/admin/players/page.tsx` — add Tournaments column (system admin view)
- `src/app/(admin)/admin/players/players-table.tsx` — render Tournaments column

---

## Task 1: Cookie helper + Server Action

**Files:**
- Create: `src/lib/active-tournament.ts`
- Create: `src/lib/actions/set-active-tournament.ts`
- Create: `src/__tests__/active-tournament.test.ts`

**Interfaces:**
- Produces:
  - `getActiveTournamentId(): Promise<string | null>` — reads cookie server-side
  - `setActiveTournamentAction(tournamentId: string): Promise<void>` — Server Action; sets cookie

- [ ] **Step 1: Create the branch**

```bash
git checkout develop && git pull origin develop
git checkout -b feature/admin-role-dashboards
```

- [ ] **Step 2: Write failing tests**

Create `src/__tests__/active-tournament.test.ts`:

```typescript
/**
 * @jest-environment node
 */
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { cookies } from 'next/headers';
import { getActiveTournamentId } from '@/lib/active-tournament';

const mockCookies = cookies as jest.Mock;

describe('getActiveTournamentId', () => {
  it('returns null when cookie is not set', async () => {
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue(undefined) });
    expect(await getActiveTournamentId()).toBeNull();
  });

  it('returns the cookie value when set', async () => {
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: 'abc-tournament-id' }),
    });
    expect(await getActiveTournamentId()).toBe('abc-tournament-id');
  });
});
```

- [ ] **Step 3: Run test to confirm failure**

```bash
npx jest src/__tests__/active-tournament.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/lib/active-tournament'`

- [ ] **Step 4: Create the cookie helper**

Create `src/lib/active-tournament.ts`:

```typescript
import { cookies } from 'next/headers';

export const ACTIVE_TOURNAMENT_COOKIE = 'x-active-tournament';

export async function getActiveTournamentId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_TOURNAMENT_COOKIE)?.value ?? null;
}
```

- [ ] **Step 5: Create the Server Action**

Create `src/lib/actions/set-active-tournament.ts`:

```typescript
'use server';

import { cookies } from 'next/headers';
import { ACTIVE_TOURNAMENT_COOKIE } from '@/lib/active-tournament';

export async function setActiveTournamentAction(tournamentId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_TOURNAMENT_COOKIE, tournamentId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}
```

- [ ] **Step 6: Run tests and type-check**

```bash
npx jest src/__tests__/active-tournament.test.ts --no-coverage
npm run type-check
```
Expected: 2 tests pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/active-tournament.ts src/lib/actions/set-active-tournament.ts src/__tests__/active-tournament.test.ts
git commit -m "feat: active-tournament cookie helper and server action"
```

---

## Task 2: AdminLayout — fetch assignments, set cookie, redirect

**Files:**
- Modify: `src/app/(admin)/layout.tsx`

**Interfaces:**
- Consumes: `getActiveTournamentId()` from `@/lib/active-tournament`, `ACTIVE_TOURNAMENT_COOKIE`
- Produces: passes `role` and `activeTournament?: { id: string; name: string }` as props to `AdminSidebar`

> Before editing, read the full current content of `src/app/(admin)/layout.tsx`.

- [ ] **Step 1: Replace layout.tsx**

The layout now:
1. Fetches the player's role
2. If `tournament_admin`: fetches their assignments; redirects to `/admin/select-tournament` if 2+; sets the cookie for single-assignment admins
3. If `system_admin`: reads the cookie (may be null on first visit); fetches the named tournament for the switcher label
4. Passes `{ role, activeTournament }` to `AdminSidebar`

```typescript
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin-sidebar';
import { ACTIVE_TOURNAMENT_COOKIE } from '@/lib/active-tournament';
import type { PlayerRole } from '@/lib/types';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: player } = await supabase
    .from('players')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (!player || (player.role !== 'system_admin' && player.role !== 'tournament_admin')) {
    redirect('/dashboard');
  }

  const role = player.role as PlayerRole;
  let activeTournament: { id: string; name: string } | undefined;

  if (role === 'tournament_admin') {
    const { data: assignments } = await supabase
      .from('tournament_admin_assignments')
      .select('tournament_id, tournaments!tournament_id(id, name)')
      .eq('player_id', player.id);

    const list = (assignments ?? []).map((a) => {
      const t = a.tournaments as unknown as { id: string; name: string } | null;
      return t ? { id: t.id, name: t.name } : null;
    }).filter(Boolean) as { id: string; name: string }[];

    if (list.length === 0) redirect('/dashboard');

    if (list.length >= 2) redirect('/admin/select-tournament');

    // Single assignment — set cookie and proceed
    const store = await cookies();
    store.set(ACTIVE_TOURNAMENT_COOKIE, list[0].id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    activeTournament = list[0];
  } else {
    // system_admin — read active tournament from cookie (may be null)
    const store = await cookies();
    const tid = store.get(ACTIVE_TOURNAMENT_COOKIE)?.value;
    if (tid) {
      const { data: t } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('id', tid)
        .single();
      if (t) activeTournament = { id: t.id, name: t.name };
    }
    // If no cookie set yet, pick the most recent tournament
    if (!activeTournament) {
      const { data: t } = await supabase
        .from('tournaments')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (t) {
        activeTournament = { id: t.id, name: t.name };
        const store = await cookies();
        store.set(ACTIVE_TOURNAMENT_COOKIE, t.id, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        });
      }
    }
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={role} activeTournament={activeTournament} />
      <main className="flex-1 overflow-auto bg-[#f4f7f1]">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```
Expected: errors only about `AdminSidebar` not accepting the new props (fixed in Task 3).

- [ ] **Step 3: Commit (with type-check warning noted)**

```bash
git add src/app/\(admin\)/layout.tsx
git commit -m "feat: admin layout fetches role + assignments, sets active-tournament cookie"
```

---

## Task 3: Role-aware AdminSidebar

**Files:**
- Modify: `src/components/admin-sidebar.tsx`

**Interfaces:**
- Consumes: `setActiveTournamentAction` from `@/lib/actions/set-active-tournament`
- Props: `{ role: PlayerRole; activeTournament?: { id: string; name: string } }`

> Read the full current content of `src/components/admin-sidebar.tsx` before editing.

- [ ] **Step 1: Replace AdminSidebar**

```typescript
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';
import {
  Trophy, Users, UsersRound, Wrench, ClipboardList, Star,
  MapPin, Flag, UserCheck, ChevronDown,
} from 'lucide-react';
import { setActiveTournamentAction } from '@/lib/actions/set-active-tournament';
import type { PlayerRole } from '@/lib/types';

const GLOBAL_NAV = [
  { href: '/admin/tournaments', label: 'Tournaments', Icon: Trophy },
  { href: '/admin/players',     label: 'Players',     Icon: Users },
  { href: '/admin/venues',      label: 'Venues',      Icon: MapPin },
  { href: '/admin/courses',     label: 'Courses',     Icon: Flag },
  { href: '/admin/clubs',       label: 'Clubs',       Icon: Wrench },
];

const TOURNAMENT_NAV = [
  { href: '/admin/roster',      label: 'Roster',      Icon: Users },
  { href: '/admin/tournament',  label: 'Tournament',  Icon: Trophy },
  { href: '/admin/teams',       label: 'Teams',       Icon: UsersRound },
  { href: '/admin/scores',      label: 'Scores',      Icon: ClipboardList },
  { href: '/admin/sponsors',    label: 'Sponsors',    Icon: Star },
];

interface AdminSidebarProps {
  role: PlayerRole;
  activeTournament?: { id: string; name: string };
}

function NavItem({ href, label, Icon }: { href: string; label: string; Icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'text-white' : 'text-[#bfe0c8] hover:text-white',
      )}
      style={active ? { background: 'rgba(255,255,255,0.14)' } : undefined}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function AdminSidebar({ role, activeTournament }: AdminSidebarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleTournamentChange = (tournamentId: string) => {
    startTransition(async () => {
      await setActiveTournamentAction(tournamentId);
      router.refresh();
    });
  };

  return (
    <aside className="flex h-full w-[212px] shrink-0 flex-col bg-[#1a472a] text-white">
      {/* Wordmark */}
      <div className="px-4 py-5 flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-lg text-lg"
          style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)' }}
        >
          ⛳
        </div>
        <div>
          <div className="font-barlow font-extrabold text-white" style={{ fontSize: 18, letterSpacing: '0.04em' }}>
            FDGOLF-CM
          </div>
          <div className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: '#9fd6ad' }}>
            Admin
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-4 px-2 pb-4 overflow-y-auto">
        {/* Global section — system_admin only */}
        {role === 'system_admin' && (
          <div>
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#6fa87a]">
              Global
            </div>
            {GLOBAL_NAV.map((item) => <NavItem key={item.href} {...item} />)}
          </div>
        )}

        {/* This Tournament section */}
        <div>
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#6fa87a]">
            This Tournament
          </div>
          {activeTournament ? (
            <div className="px-3 py-1 mb-1 text-xs font-semibold text-[#9fd6ad] truncate flex items-center gap-1">
              <span className="truncate">{activeTournament.name}</span>
              {role === 'system_admin' && (
                <button
                  onClick={() => {
                    // Switcher: navigate to /admin/tournaments to change active tournament
                    router.push('/admin/tournaments');
                  }}
                  className="shrink-0 text-[#6fa87a] hover:text-white transition-colors"
                  title="Switch tournament"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="px-3 py-1 mb-1 text-xs text-[#6fa87a] italic">No tournament selected</div>
          )}
          {TOURNAMENT_NAV.map((item) => <NavItem key={item.href} {...item} />)}
        </div>
      </nav>

      {/* Signed-in card */}
      <div className="mx-2 mb-3 rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: '0.12em', color: '#9fd6ad' }}>
          Signed In
        </div>
        <div className="text-sm font-semibold text-white mt-0.5">
          {role === 'system_admin' ? 'System Admin' : 'Tournament Admin'}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Type-check and tests**

```bash
npm run type-check
npm run test:ci
```
Expected: type-check clean, 145+ tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin-sidebar.tsx
git commit -m "feat: role-aware admin sidebar with Global and This Tournament sections"
```

---

## Task 4: Tournament picker page (`/admin/select-tournament`)

**Files:**
- Create: `src/app/(admin)/admin/select-tournament/page.tsx`

**Interfaces:**
- Consumes: `setActiveTournamentAction` from `@/lib/actions/set-active-tournament`
- Visible only to `tournament_admin` with 2+ assignments (layout redirects here automatically)

- [ ] **Step 1: Create page**

Create `src/app/(admin)/admin/select-tournament/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { setActiveTournamentAction } from '@/lib/actions/set-active-tournament';

export default async function SelectTournamentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!player) redirect('/dashboard');

  const { data: assignments } = await supabase
    .from('tournament_admin_assignments')
    .select('tournament_id, tournaments!tournament_id(id, name, date, status)')
    .eq('player_id', player.id);

  const tournaments = (assignments ?? [])
    .map((a) => a.tournaments as unknown as { id: string; name: string; date: string; status: string } | null)
    .filter(Boolean) as { id: string; name: string; date: string; status: string }[];

  async function selectTournament(tournamentId: string) {
    'use server';
    await setActiveTournamentAction(tournamentId);
    redirect('/admin/roster');
  }

  return (
    <div className="min-h-screen bg-[#f4f7f1] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#90a094] mb-1">
          TOURNAMENT MANAGEMENT
        </p>
        <h1 className="font-barlow font-extrabold text-[28px] leading-none text-[#15241c] mb-6">
          Select Tournament
        </h1>
        <div className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <form key={t.id} action={selectTournament.bind(null, t.id)}>
              <button
                type="submit"
                className="w-full text-left bg-white rounded-2xl border border-[#e2e8df] px-5 py-4 hover:border-[#1a472a] hover:shadow-sm transition-all"
              >
                <div className="font-semibold text-[17px] text-[#15241c]">{t.name}</div>
                <div className="text-[13px] text-[#6b7a70] mt-0.5">
                  {t.date} · <span className="capitalize">{t.status}</span>
                </div>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/select-tournament/page.tsx
git commit -m "feat: tournament picker page for multi-assignment tournament admins"
```

---

## Task 5: Fix scoped pages to use active-tournament cookie

Currently `teams/page.tsx`, `scores/page.tsx`, and `sponsors/page.tsx` all find the tournament by `.order('created_at').limit(1)`. Replace with the cookie.

**Files:**
- Modify: `src/app/(admin)/admin/teams/page.tsx`
- Modify: `src/app/(admin)/admin/scores/page.tsx`
- Modify: `src/app/(admin)/admin/sponsors/page.tsx`

> Read each file in full before editing.

- [ ] **Step 1: Update teams/page.tsx**

Replace the tournament query block. Find this pattern (approximately lines 8–14):

```typescript
const { data: tournament } = await supabase
  .from('tournaments')
  .select('id')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

const tournamentId = tournament?.id ?? '';
```

Replace with:

```typescript
import { getActiveTournamentId } from '@/lib/active-tournament';
// ... (add to existing imports at top)

// Inside the component:
const tournamentId = (await getActiveTournamentId()) ?? '';
```

- [ ] **Step 2: Update scores/page.tsx**

Read the file. Find where `tid` is assigned from a tournament query (approximately lines 8–15). Replace with:

```typescript
import { getActiveTournamentId } from '@/lib/active-tournament';
// ...
const tid = (await getActiveTournamentId()) ?? '';
```

- [ ] **Step 3: Update sponsors/page.tsx**

Read the file. Find the tournament ID lookup. Replace with `getActiveTournamentId()` in the same pattern.

- [ ] **Step 4: Type-check and tests**

```bash
npm run type-check
npm run test:ci
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/admin/teams/page.tsx src/app/\(admin\)/admin/scores/page.tsx src/app/\(admin\)/admin/sponsors/page.tsx
git commit -m "fix: scoped admin pages read active tournament from cookie instead of most-recent query"
```

---

## Task 6: `/admin/tournaments` — global tournament list

**Files:**
- Create: `src/app/(admin)/admin/tournaments/page.tsx`
- Create: `src/app/(admin)/admin/tournaments/tournaments-list.tsx`

**Interfaces:**
- Produces: clicking a tournament card sets the active-tournament cookie and navigates to `/admin/tournament`

- [ ] **Step 1: Create the server page**

Create `src/app/(admin)/admin/tournaments/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TournamentsList } from './tournaments-list';

export default async function TournamentsPage() {
  const supabase = await createClient();

  const [{ data: tournaments }, { data: venues }, { data: courses }] = await Promise.all([
    supabase
      .from('tournaments')
      .select(`
        id, name, slug, date, status, format,
        venue:venues!venue_id(name),
        course:courses!course_id(name)
      `)
      .order('date', { ascending: false }),
    supabase.from('venues').select('id, name').order('name'),
    supabase.from('courses').select('id, name, venue_id').order('name'),
  ]);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a472a]">Tournaments</h1>
        <p className="text-sm text-gray-500 mt-1">All tournaments across all venues</p>
      </div>
      <TournamentsList
        tournaments={(tournaments ?? []) as Parameters<typeof TournamentsList>[0]['tournaments']}
        venues={venues ?? []}
        courses={courses ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the client component**

Create `src/app/(admin)/admin/tournaments/tournaments-list.tsx`:

```typescript
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AdminTopBar } from '@/components/admin-top-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setActiveTournamentAction } from '@/lib/actions/set-active-tournament';
import type { TournamentStatus } from '@/lib/types';

interface TournamentRow {
  id: string;
  name: string;
  slug: string;
  date: string;
  status: TournamentStatus;
  format: string;
  venue: { name: string } | null;
  course: { name: string } | null;
}

interface Venue { id: string; name: string }
interface Course { id: string; name: string; venue_id: string }

const STATUS_STYLES: Record<TournamentStatus, string> = {
  setup:    'bg-[#eef2ea] text-[#1a472a]',
  active:   'bg-[#e3f4e8] text-[#166534]',
  paused:   'bg-[#fef9c3] text-[#854d0e]',
  complete: 'bg-[#e0eeff] text-[#1e4fa0]',
};

const EMPTY_FORM = { name: '', slug: '', date: '', format: 'best_ball', venueId: '', courseId: '' };

export function TournamentsList({
  tournaments: initial,
  venues,
  courses,
}: {
  tournaments: TournamentRow[];
  venues: Venue[];
  courses: Course[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tournaments, setTournaments] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredCourses = form.venueId
    ? courses.filter((c) => c.venue_id === form.venueId)
    : courses;

  function cancel() {
    setShowAdd(false);
    setForm(EMPTY_FORM);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        name: form.name.trim(),
        slug: form.slug.trim(),
        date: form.date,
        format: form.format,
        venue_id: form.venueId,
        course_id: form.courseId,
        status: 'setup' as TournamentStatus,
      })
      .select('id, name, slug, date, status, format, venue:venues!venue_id(name), course:courses!course_id(name)')
      .single();

    if (error) { toast.error(error.message); setSaving(false); return; }
    setTournaments((prev) => [data as TournamentRow, ...prev]);
    toast.success('Tournament created.');
    cancel();
    setSaving(false);
  }

  async function handleManage(tournament: TournamentRow) {
    startTransition(async () => {
      await setActiveTournamentAction(tournament.id);
      router.push('/admin/tournament');
    });
  }

  const isAdding = showAdd;

  const FormPanel = (
    <form onSubmit={handleCreate} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[#6b7a70]">Name *</Label>
        <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[#6b7a70]">Slug *</Label>
        <Input required value={form.slug} placeholder="my-tournament-2026" onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="h-8 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[#6b7a70]">Date *</Label>
        <Input required type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-8 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[#6b7a70]">Venue *</Label>
        <select required value={form.venueId} onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value, courseId: '' }))}
          className="h-8 rounded-md border border-input px-3 text-sm focus:border-[#1a472a] focus:outline-none">
          <option value="">Select venue…</option>
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[#6b7a70]">Course *</Label>
        <select required value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
          className="h-8 rounded-md border border-input px-3 text-sm focus:border-[#1a472a] focus:outline-none">
          <option value="">Select course…</option>
          {filteredCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={cancel}
          className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#15241c]">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#1a472a] text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Tournament'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex flex-col">
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Tournaments">
        <button
          onClick={() => { setShowAdd(true); }}
          className="rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#1a472a] text-white"
        >
          + Add Tournament
        </button>
      </AdminTopBar>

      <div className="px-7 py-6 flex gap-6">
        {/* Left: tournament card list */}
        <div className="flex-1 flex flex-col gap-4">
          {tournaments.length === 0 && (
            <p className="text-[14px] text-[#6b7a70]">No tournaments yet — add one.</p>
          )}
          {tournaments.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-[#e2e8df] p-5 flex items-start gap-4">
              <div
                className="rounded-[13px] bg-[#eef2ea] flex items-center justify-center shrink-0"
                style={{ width: 52, height: 52 }}
              >
                <span style={{ fontSize: 22 }}>🏆</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[17px] text-[#15241c]">{t.name}</p>
                <p className="text-[13px] text-[#6b7a70] mt-0.5">
                  {t.date} · {t.venue?.name ?? '—'} · {t.course?.name ?? '—'}
                </p>
                <div className="flex gap-2 mt-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold capitalize ${STATUS_STYLES[t.status]}`}>
                    {t.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleManage(t)}
                disabled={isPending}
                className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a] shrink-0 disabled:opacity-50"
              >
                Manage
              </button>
            </div>
          ))}
        </div>

        {/* Right: Add form */}
        {isAdding && (
          <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6 self-start">
            <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">Add Tournament</p>
            {FormPanel}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/tournaments/
git commit -m "feat: /admin/tournaments global tournament list with inline create"
```

---

## Task 7: Tournament Admins panel on `/admin/tournament`

**Files:**
- Create: `src/app/(admin)/admin/tournament/tournament-admins.tsx`
- Modify: `src/app/(admin)/admin/tournament/page.tsx`

> Read `src/app/(admin)/admin/tournament/page.tsx` in full before editing.

**Interfaces:**
- Consumes: `tournament_admin_assignments` table; `players` table for search
- Props: `{ tournamentId: string }`

- [ ] **Step 1: Create tournament-admins.tsx**

Create `src/app/(admin)/admin/tournament/tournament-admins.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';

interface AdminRow {
  id: string;
  player_id: string;
  name: string;
  email: string;
}

interface PlayerResult {
  id: string;
  name: string;
  email: string;
}

export function TournamentAdmins({ tournamentId }: { tournamentId: string }) {
  const supabase = createClient();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tournament_admin_assignments')
        .select('id, player_id, players!player_id(name, email)')
        .eq('tournament_id', tournamentId);
      setAdmins(
        (data ?? []).map((a) => {
          const p = a.players as unknown as { name: string; email: string } | null;
          return { id: a.id, player_id: a.player_id, name: p?.name ?? '', email: p?.email ?? '' };
        }),
      );
    }
    load();
  }, [tournamentId, supabase]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, email')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(8);
      setResults((data ?? []) as PlayerResult[]);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, supabase]);

  async function assign(player: PlayerResult) {
    setLoading(true);
    const { data, error } = await supabase
      .from('tournament_admin_assignments')
      .insert({ player_id: player.id, tournament_id: tournamentId })
      .select('id, player_id')
      .single();

    if (error) { toast.error(error.message); setLoading(false); return; }

    await supabase
      .from('players')
      .update({ role: 'tournament_admin' })
      .eq('id', player.id)
      .eq('role', 'player');

    setAdmins((prev) => [...prev, { id: data.id, player_id: data.player_id, name: player.name, email: player.email }]);
    toast.success(`${player.name} assigned as tournament admin.`);
    setQuery('');
    setResults([]);
    setLoading(false);
  }

  async function remove(assignmentId: string) {
    const { error } = await supabase
      .from('tournament_admin_assignments')
      .delete()
      .eq('id', assignmentId);
    if (error) { toast.error(error.message); return; }
    setAdmins((prev) => prev.filter((a) => a.id !== assignmentId));
    toast.success('Admin removed.');
    setConfirmRemoveId(null);
  }

  return (
    <section className="bg-white rounded-2xl border border-[#e2e8df] p-5 space-y-4">
      <p className="font-barlow font-bold text-[18px] text-[#15241c]">Tournament Admins</p>

      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player by name or email…"
          className="h-8 text-sm"
        />
        {results.length > 0 && (
          <div className="absolute z-10 top-full mt-1 w-full rounded-2xl border border-[#e2e8df] bg-white shadow-lg overflow-hidden">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => assign(p)}
                disabled={loading}
                className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#eef2ea] flex justify-between items-center"
              >
                <span className="font-medium text-[#15241c]">{p.name}</span>
                <span className="text-[#6b7a70]">{p.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {admins.length === 0 ? (
        <p className="text-[13px] text-[#6b7a70] italic">No admins assigned yet.</p>
      ) : (
        <ul className="divide-y divide-[#e2e8df]">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-[#15241c]">{a.name}</div>
                <div className="text-[12px] text-[#6b7a70]">{a.email}</div>
              </div>
              {confirmRemoveId === a.id ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-[#6b7a70]">Remove?</span>
                  <button onClick={() => remove(a.id)} className="font-semibold text-[#a8513f] hover:underline">Yes</button>
                  <button onClick={() => setConfirmRemoveId(null)} className="text-[#6b7a70] hover:underline">No</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemoveId(a.id)}
                  className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add TournamentAdmins to the tournament page**

Read `src/app/(admin)/admin/tournament/page.tsx` in full. Find the return statement. The page conditionally shows `TournamentControlDashboard` (for active/paused) or `TournamentManager` (for setup/complete). In **both** branches, add `<TournamentAdmins tournamentId={activeTournament.id} />` (for the active branch) and at the bottom of the `TournamentManager` render (for the setup/complete branch).

Add this import at the top of `page.tsx`:
```typescript
import { TournamentAdmins } from './tournament-admins';
import { getActiveTournamentId } from '@/lib/active-tournament';
```

The page currently uses `activeTournament` from the query. Ensure `activeTournament.id` is accessible and pass it to `<TournamentAdmins tournamentId={activeTournament.id} />`.

Also update the tournament page to use the cookie for the initial tournament selection, similar to Task 5. Find where the page determines which tournament to show and replace the implicit "most recent" selection with:
```typescript
const activeTournamentId = await getActiveTournamentId();
const activeTournament = activeTournamentId
  ? rows.find((t) => t.id === activeTournamentId) ?? rows[0] ?? null
  : rows[0] ?? null;
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/tournament/tournament-admins.tsx src/app/\(admin\)/admin/tournament/page.tsx
git commit -m "feat: tournament admins panel — assign/remove admins from tournament detail page"
```

---

## Task 8: `/admin/roster` — tournament-scoped player enrollment

**Files:**
- Create: `src/app/(admin)/admin/roster/page.tsx`
- Create: `src/app/(admin)/admin/roster/roster-manager.tsx`

**Interfaces:**
- Consumes: `getActiveTournamentId()` for scoping; `tournament_players` and `players` tables; `teams` for team assignment
- Props: `{ tournamentId: string; players: RosterPlayer[]; teams: Team[] }`

- [ ] **Step 1: Create the server page**

Create `src/app/(admin)/admin/roster/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveTournamentId } from '@/lib/active-tournament';
import { RosterManager } from './roster-manager';
import type { Team } from '@/lib/types';

export interface RosterPlayer {
  id: string;
  player_id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  team_id: string | null;
  team_name: string | null;
}

export default async function RosterPage() {
  const tournamentId = await getActiveTournamentId();
  if (!tournamentId) redirect('/admin/tournaments');

  const supabase = await createClient();

  const [{ data: memberships }, { data: teams }] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('id, player_id, team_id, players!player_id(name, email, company, title), teams!team_id(team_name)')
      .eq('tournament_id', tournamentId),
    supabase.from('teams').select('id, team_name, team_number').eq('tournament_id', tournamentId).order('team_number'),
  ]);

  const players: RosterPlayer[] = (memberships ?? []).map((m) => {
    const p = m.players as unknown as { name: string; email: string; company: string; title: string } | null;
    const t = m.teams as unknown as { team_name: string } | null;
    return {
      id: m.id,
      player_id: m.player_id,
      name: p?.name ?? '',
      email: p?.email ?? '',
      company: p?.company ?? '',
      title: p?.title ?? '',
      team_id: m.team_id,
      team_name: t?.team_name ?? null,
    };
  });

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a472a]">Roster</h1>
        <p className="text-sm text-gray-500 mt-1">Players enrolled in this tournament</p>
      </div>
      <RosterManager
        tournamentId={tournamentId}
        players={players}
        teams={(teams as Team[]) ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create roster-manager.tsx**

Create `src/app/(admin)/admin/roster/roster-manager.tsx`:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AdminTopBar } from '@/components/admin-top-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Team } from '@/lib/types';
import type { RosterPlayer } from './page';

const EMPTY_NEW = { name: '', email: '', company: '', title: '', teamId: '' };

interface PlayerSearchResult { id: string; name: string; email: string }

export function RosterManager({
  tournamentId,
  players: initial,
  teams,
}: {
  tournamentId: string;
  players: RosterPlayer[];
  teams: Team[];
}) {
  const supabase = createClient();
  const [players, setPlayers] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchTeamId, setSearchTeamId] = useState('');

  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, email')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(8);
      setSearchResults((data ?? []) as PlayerSearchResult[]);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, supabase]);

  async function enrollExisting(player: PlayerSearchResult) {
    setSaving(true);
    const { data, error } = await supabase
      .from('tournament_players')
      .insert({ player_id: player.id, tournament_id: tournamentId, team_id: searchTeamId || null })
      .select('id, player_id, team_id, teams!team_id(team_name)')
      .single();

    if (error) { toast.error(error.message); setSaving(false); return; }
    const t = data.teams as unknown as { team_name: string } | null;
    setPlayers((prev) => [...prev, {
      id: data.id, player_id: data.player_id,
      name: player.name, email: player.email, company: '', title: '',
      team_id: data.team_id, team_name: t?.team_name ?? null,
    }]);
    toast.success(`${player.name} added to roster.`);
    setSearchQuery(''); setSearchResults([]); setSearchTeamId('');
    setSaving(false); setShowAdd(false);
  }

  async function createAndEnroll(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: p, error: pErr } = await supabase
      .from('players')
      .insert({ name: newForm.name.trim(), email: newForm.email.trim(), company: newForm.company.trim(), title: newForm.title.trim(), role: 'player' })
      .select('id, name, email')
      .single();

    if (pErr) { toast.error(pErr.message); setSaving(false); return; }

    const { data: tp, error: tpErr } = await supabase
      .from('tournament_players')
      .insert({ player_id: p.id, tournament_id: tournamentId, team_id: newForm.teamId || null })
      .select('id, player_id, team_id, teams!team_id(team_name)')
      .single();

    if (tpErr) { toast.error(tpErr.message); setSaving(false); return; }
    const t = tp.teams as unknown as { team_name: string } | null;
    setPlayers((prev) => [...prev, {
      id: tp.id, player_id: tp.player_id,
      name: p.name, email: p.email, company: newForm.company, title: newForm.title,
      team_id: tp.team_id, team_name: t?.team_name ?? null,
    }]);
    toast.success(`${p.name} created and enrolled.`);
    setNewForm(EMPTY_NEW); setSaving(false); setShowNew(false);
  }

  async function removeFromTournament(membershipId: string) {
    const { error } = await supabase.from('tournament_players').delete().eq('id', membershipId);
    if (error) { toast.error(error.message); return; }
    setPlayers((prev) => prev.filter((p) => p.id !== membershipId));
    toast.success('Player removed from tournament.');
    setConfirmRemoveId(null);
  }

  const AddExistingForm = (
    <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6 self-start">
      <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">Add Existing Player</p>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-8 text-sm"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full rounded-2xl border border-[#e2e8df] bg-white shadow-lg overflow-hidden">
              {searchResults.map((p) => (
                <button key={p.id} onClick={() => enrollExisting(p)} disabled={saving}
                  className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#eef2ea] flex justify-between">
                  <span className="font-medium text-[#15241c]">{p.name}</span>
                  <span className="text-[#6b7a70]">{p.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[#6b7a70]">Assign to team</Label>
          <select value={searchTeamId} onChange={(e) => setSearchTeamId(e.target.value)}
            className="h-8 rounded-md border border-input px-3 text-sm focus:border-[#1a472a] focus:outline-none">
            <option value="">No team yet</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowAdd(false); setSearchQuery(''); setSearchResults([]); }}
          className="rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#15241c]">
          Cancel
        </button>
      </div>
    </div>
  );

  const NewPlayerForm = (
    <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6 self-start">
      <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">New Player</p>
      <form onSubmit={createAndEnroll} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[#6b7a70]">Name *</Label>
          <Input required value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[#6b7a70]">Email *</Label>
          <Input required type="email" value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[#6b7a70]">Company</Label>
          <Input value={newForm.company} onChange={(e) => setNewForm((f) => ({ ...f, company: e.target.value }))} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[#6b7a70]">Title</Label>
          <Input value={newForm.title} onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))} className="h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[#6b7a70]">Team</Label>
          <select value={newForm.teamId} onChange={(e) => setNewForm((f) => ({ ...f, teamId: e.target.value }))}
            className="h-8 rounded-md border border-input px-3 text-sm focus:border-[#1a472a] focus:outline-none">
            <option value="">No team yet</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => { setShowNew(false); setNewForm(EMPTY_NEW); }}
            className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#15241c]">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#1a472a] text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Create & Enroll'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="flex flex-col">
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Roster">
        <button onClick={() => { setShowAdd(true); setShowNew(false); }}
          className="rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]">
          + Add Existing
        </button>
        <button onClick={() => { setShowNew(true); setShowAdd(false); }}
          className="rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#1a472a] text-white">
          + New Player
        </button>
      </AdminTopBar>

      <div className="px-7 py-6 flex gap-6">
        {/* Left: player list */}
        <div className="flex-1 flex flex-col gap-4">
          {players.length === 0 && (
            <p className="text-[14px] text-[#6b7a70]">No players enrolled yet.</p>
          )}
          {players.map((p) => (
            <React.Fragment key={p.id}>
              <div className="bg-white rounded-2xl border border-[#e2e8df] p-5 flex items-start gap-4">
                <div className="rounded-[13px] bg-[#eef2ea] flex items-center justify-center shrink-0" style={{ width: 52, height: 52 }}>
                  <span style={{ fontSize: 22 }}>👤</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[17px] text-[#15241c]">{p.name}</p>
                  <p className="text-[13px] text-[#6b7a70] mt-0.5">{p.email}</p>
                  <div className="flex gap-2 mt-2">
                    {p.team_name ? (
                      <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#e9f3ec] text-[#1a472a]">
                        {p.team_name}
                      </span>
                    ) : (
                      <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#f4f7f1] text-[#6b7a70]">
                        No team
                      </span>
                    )}
                    {p.company && (
                      <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#eef2ea] text-[#6b7a70]">
                        {p.company}
                      </span>
                    )}
                  </div>
                </div>
                {confirmRemoveId === p.id ? (
                  <div className="flex items-center gap-2 shrink-0 text-[13px]">
                    <span className="text-[#6b7a70]">Remove?</span>
                    <button onClick={() => removeFromTournament(p.id)} className="font-semibold text-[#a8513f] hover:underline">Yes</button>
                    <button onClick={() => setConfirmRemoveId(null)} className="text-[#6b7a70] hover:underline">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmRemoveId(p.id)}
                    className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f] shrink-0">
                    Remove
                  </button>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Right: form panel */}
        {showAdd && AddExistingForm}
        {showNew && NewPlayerForm}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and tests**

```bash
npm run type-check
npm run test:ci
```
Expected: clean, 145+ tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/roster/
git commit -m "feat: /admin/roster — tournament-scoped player enrollment (add existing, create new, remove)"
```

---

## Task 9: Global players page — Tournaments column

**Files:**
- Modify: `src/app/(admin)/admin/players/page.tsx`
- Modify: `src/app/(admin)/admin/players/players-table.tsx`

> Read both files in full before editing.

- [ ] **Step 1: Update players/page.tsx to join tournament memberships**

In the players server page, add a join to fetch each player's tournaments:

Find the existing `supabase.from('players').select(...)` call and extend the select:

```typescript
supabase
  .from('players')
  .select('*, tournament_players!player_id(tournament_id, tournaments!tournament_id(name))')
  .order('name')
```

Map the result to include a `tournamentNames: string[]` field on each player and pass it to `PlayersTable`.

- [ ] **Step 2: Update players-table.tsx to render Tournaments column**

In `PlayersTable`, extend the player type to include `tournamentNames: string[]`. Add a "Tournaments" column header and render cell:

```tsx
<th className="px-4 py-3 text-left">Tournaments</th>
// ...in the row:
<td className="px-4 py-3 text-gray-500 text-xs">
  {player.tournamentNames.length > 0 ? player.tournamentNames.join(', ') : <span className="italic text-gray-300">—</span>}
</td>
```

- [ ] **Step 3: Type-check and tests**

```bash
npm run type-check
npm run test:ci
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/players/page.tsx src/app/\(admin\)/admin/players/players-table.tsx
git commit -m "feat: global players page shows tournament memberships column"
```

---

## Task 10: Open PR

- [ ] **Step 1: Push branch and open PR**

```bash
git push origin feature/admin-role-dashboards
gh pr create --base develop --head feature/admin-role-dashboards \
  --title "feat: system admin UI + scoped tournament admin dashboard" \
  --body "Implements role-aware admin sidebar, /admin/tournaments list, /admin/roster enrollment, tournament admins panel, tournament picker, and active-tournament cookie scoping. See docs/superpowers/specs/2026-06-21-admin-role-dashboards-design.md."
```

- [ ] **Step 2: Verify CI passes**

```bash
gh pr view --json statusCheckRollup
```
Expected: all checks SUCCESS.
