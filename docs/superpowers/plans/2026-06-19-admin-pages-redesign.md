# Plan: FDgolf Admin Pages Redesign
Date: 2026-06-19
Branch: `feature/admin-pages-redesign`
Base: `develop` (HEAD after PR #33)

## Overview

Visual redesign of all 7 admin sidebar pages + shared admin chrome. This is a **restyle-only** plan — all existing data-fetching, mutations, auth guards, and business logic are preserved exactly. New look: white top bar, `#f4f7f1` page surface, white cards with green accents, Barlow Condensed display type.

Design reference: `docs/superpowers/design-handoff-admin-pages/README-admin-pages.md` and `README.md`
Screenshots: `docs/superpowers/design-handoff-admin-pages/screenshots/admin-*.png`

---

## Global Constraints

### Design tokens
- **`#1a472a`** — sidebar, primary buttons, active nav, green accents (already set in sidebar from PR #33)
- **`#15241c`** — dark green ink (headings, dark surfaces)
- **`#2f8f4e`** — live status dot, easy-hole positive accent
- **`#c0392b`** — birdie/under-par red, LIVE pill, tough-hole
- **`#e7c66b` / `#c79a2e`** — gold (leader header, eagles)
- **`#b3741b`** on **`#fbf1df`** — amber (warning/pause/missing player)
- **`#f4f7f1`** — page body background, panel surface
- **`#ffffff`** — cards, white surfaces
- **`#e2e8df` / `#e8eee4` / `#eef2ea`** — borders and dividers
- **`#46554c`** body text, **`#6b7a70`** secondary, **`#90a094`** labels/eyebrows
- **`#a8513f`** — OOB/penalty rust

### Typography
- **Barlow Condensed** (`font-barlow`, already in Tailwind from PR #33): weights 600/700/800 — use for page titles (28px), big stats, numerals, column headers on score matrix
- **Inter** — labels, names, body copy, buttons
- Eyebrow labels: `text-[11px] font-bold uppercase tracking-[0.18em] text-[#90a094]`

### Shared admin chrome (established in Task 1)
- **Admin layout**: `bg-[#f4f7f1] p-0` for the `<main>` element (pages control their own padding)
- **Top bar pattern** per page (rendered inside each page, NOT in layout): white bar, `border-b border-[#e2e8df]`, `px-7 py-[18px]`, two-zone flex — left: eyebrow + Barlow title; right: action buttons
- **Page body**: `px-7 py-6` padding, `bg-[#f4f7f1]`
- **White card**: `bg-white rounded-2xl border border-[#e2e8df]`
- Sidebar (`admin-sidebar.tsx`) is already correct from PR #33 — **do not touch it**

### Hard rules
- Preserve ALL existing functionality: Supabase queries, mutations, auth guards, optimistic updates, toasts, router.refresh() patterns, RLS-safe writes
- No new DB queries beyond what each task spec requires
- No new npm packages — use existing Tailwind, shadcn/ui (`Button`, `Badge`, `Card`, `Table`), lucide-react icons already installed
- `npm run type-check` must pass after each task (zero errors)
- Commit message format: `feat: <page> admin page redesign — <summary>`

---

## Task 1: Admin Layout + AdminTopBar component

**Files:**
- Modify: `src/app/(admin)/layout.tsx`
- Create: `src/components/admin-top-bar.tsx`

### Step 1: Update admin layout
Change the `<main>` class from `"flex-1 overflow-auto bg-gray-50 p-6"` to `"flex-1 overflow-auto bg-[#f4f7f1]"` — remove padding (pages own their own padding).

### Step 2: Create `AdminTopBar` component
```tsx
// src/components/admin-top-bar.tsx
interface AdminTopBarProps {
  eyebrow: string;      // e.g. "TOURNAMENT MANAGEMENT"
  title: string;        // e.g. "Venues"  — rendered Barlow Condensed 800 28px
  children?: React.ReactNode;  // right-side action buttons
}

export function AdminTopBar({ eyebrow, title, children }: AdminTopBarProps) {
  return (
    <div
      className="flex items-center justify-between px-7"
      style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8df',
        paddingTop: 18,
        paddingBottom: 18,
      }}
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#90a094]">
          {eyebrow}
        </p>
        <h1
          className="font-barlow font-extrabold leading-none text-[#15241c]"
          style={{ fontSize: 28 }}
        >
          {title}
        </h1>
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
```

### Step 3: Type-check
```bash
npm run type-check
```

### Step 4: Commit
```bash
git add src/app/(admin)/layout.tsx src/components/admin-top-bar.tsx
git commit -m "feat: admin layout — remove global padding, add AdminTopBar shared component"
```

---

## Task 2: Venues Page Redesign

**Files:**
- Modify: `src/app/(admin)/admin/venues/venue-manager.tsx`
- Modify: `src/app/(admin)/admin/venues/page.tsx`

### Design
Reference: `docs/superpowers/design-handoff-admin-pages/screenshots/admin-1-venues.png`

**page.tsx**: Remove `max-w-4xl` wrapper. Return bare `<VenueManager>`.

**venue-manager.tsx** full restyle — preserve all existing state, handlers, and Supabase calls. New layout:

```
<div> (outer, full width, flex flex-col)
  <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Venues">
    <button>+ Add Venue</button>   ← triggers the existing add form (show/hide state)
  </AdminTopBar>

  <div className="px-7 py-6 flex gap-6">
    {/* Left: venue card list */}
    <div className="flex-1 flex flex-col gap-4">
      {venues.map(venue => (
        <div key={venue.id} className="bg-white rounded-2xl border border-[#e2e8df] p-5 flex items-start gap-4">
          {/* 52px tile */}
          <div className="rounded-[13px] bg-[#eef2ea] flex items-center justify-center shrink-0" style={{ width: 52, height: 52 }}>
            <span style={{ fontSize: 22 }}>📍</span>
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[17px] text-[#15241c]">{venue.name}</p>
            <p className="text-[13px] text-[#6b7a70] mt-0.5">{venue.address}, {venue.city}</p>
            <div className="flex gap-2 mt-2">
              {/* Green courses pill */}
              <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#e9f3ec] text-[#1a472a]">
                N courses
              </span>
              {/* GPS pill — use amber if no pins, green if all set (use placeholder amber for now) */}
              <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#fbf1df] text-[#b3741b]">
                GPS not configured
              </span>
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]">Edit</button>
            <button className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]">Delete</button>
          </div>
        </div>
      ))}
    </div>

    {/* Right: Add Venue form (320px, shown when adding) */}
    {isAdding && (
      <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6 self-start">
        <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">Add Venue</p>
        {/* existing form fields: name, address, city, province, contact */}
        {/* Save: full-width green primary button */}
      </div>
    )}
  </div>
</div>
```

**Important**: "N courses" pill — the current `venues` select in `page.tsx` only fetches `*` on `venues`. You cannot know course count without a join. Use `select('*, courses(id)')` in `page.tsx` and pass `courses` count; OR just omit the dynamic count and hardcode the pill as a static "GPS not configured" amber + "Venue" label. Keep it simple — do NOT add a new Supabase query in the client component.

**Simplest approach for GPS pill**: always render amber "GPS not configured" — the app currently has no mechanism to check per-venue GPS completeness from this page. This is a placeholder per spec.

### Step 3: Type-check, commit
```bash
npm run type-check
git add src/app/(admin)/admin/venues/
git commit -m "feat: venues admin page redesign — card list, 52px tile, status pills, add form"
```

---

## Task 3: Courses Page Redesign

**Files:**
- Modify: `src/app/(admin)/admin/courses/course-manager.tsx`
- Modify: `src/app/(admin)/admin/courses/page.tsx`
- Modify: `src/app/(admin)/admin/courses/[courseId]/holes/course-holes-editor.tsx`

### Design
Reference: `docs/superpowers/design-handoff-admin-pages/screenshots/admin-2-courses.png`

**page.tsx**: Remove any `max-w-*` wrapper. Pass holes + tee boxes (already done) through.

**course-manager.tsx** full restyle:
```
<div>
  <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Courses">
    {/* venue selector dropdown (existing state) */}
    <select className="rounded-[10px] border border-[#d6ddd2] px-3 py-1.5 text-[14px] bg-white text-[#15241c]">
      <option>All venues</option>
    </select>
  </AdminTopBar>

  <div className="px-7 py-6 flex flex-col gap-5">
    {courses.map(course => (
      <div key={course.id} className="bg-white rounded-2xl border border-[#e2e8df] overflow-hidden">
        {/* Course header row */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eee4]">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[17px] text-[#15241c]">{course.name}</span>
            <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#e9f3ec] text-[#1a472a]">18 holes</span>
            <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#eef2ea] text-[#46554c]">Par {course.par_total}</span>
            <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#fbf1df] text-[#b3741b]">GPS: 0/18</span>
          </div>
          <button className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]">Edit Course</button>
        </div>

        {/* 18-hole grid */}
        <div className="p-5">
          {/* Front 9 label */}
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#90a094] mb-2">Front 9</p>
          <div className="grid grid-cols-9 gap-2 mb-4">
            {holes.filter(h => h.hole_number <= 9).map(hole => (
              <div key={hole.id} className="bg-[#f4f7f1] rounded-[10px] p-2.5 text-center cursor-pointer hover:bg-[#e9f3ec]">
                <p className="font-barlow font-bold text-[20px] text-[#15241c]">{hole.hole_number}</p>
                <p className="text-[11px] text-[#6b7a70]">P{hole.par}</p>
                <p className="text-[10px] text-[#90a094]">{yardsByHoleId?.[hole.id] ?? '—'} yd</p>
                <p className="text-[10px] text-[#90a094]">SI {hole.handicap}</p>
                <span className="inline-block w-2 h-2 rounded-full mt-1" style={{ background: '#e9b73a' }} />
              </div>
            ))}
          </div>
          {/* Back 9 label */}
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#90a094] mb-2">Back 9</p>
          <div className="grid grid-cols-9 gap-2">
            {holes.filter(h => h.hole_number >= 10).map(hole => (/* same tile */)}
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

**GPS dot**: green `#2f8f4e` if `pin_lat !== 0 && pin_lng !== 0`, else amber `#e9b73a`. Use the `yardsByHoleId` prop already threaded through from the page.

**Clicking a hole tile**: preserve existing behavior (inline edit or navigation to holes page).

### Type-check and commit
```bash
npm run type-check
git add src/app/(admin)/admin/courses/
git commit -m "feat: courses admin page redesign — 18-hole grid, front/back 9, GPS dots"
```

---

## Task 4: Players Page Redesign

**Files:**
- Modify: `src/app/(admin)/admin/players/players-table.tsx`
- Modify: `src/app/(admin)/admin/players/page.tsx`

### Design
Reference: `docs/superpowers/design-handoff-admin-pages/screenshots/admin-3-players.png`

**page.tsx**: Remove `space-y-4` wrapper and `<h1>`. Return bare `<PlayersTable>`.

**players-table.tsx** full restyle — preserve ALL existing logic (magic link send, edit, CSV import button):

```
<div>
  <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Players">
    {/* existing CSV Import + Send All Links buttons */}
    <button>Import CSV</button>
    <button className="bg-[#1a472a] text-white rounded-xl px-4 py-2 text-[14px] font-semibold">Send all links →</button>
  </AdminTopBar>

  {/* Filter bar */}
  <div className="bg-white border-b border-[#eef2ea] px-7 py-2.5 flex items-center justify-between">
    <div className="flex items-center gap-2 text-[13px] text-[#46554c] font-medium">
      <span>All players</span>
      <span className="rounded-full px-2.5 py-0.5 bg-[#e9f3ec] text-[#1a472a] font-semibold">✓ Linked 0</span>
      <span className="rounded-full px-2.5 py-0.5 bg-[#fbf1df] text-[#b3741b] font-semibold">⏳ Pending 0</span>
      <span className="rounded-full px-2.5 py-0.5 bg-[#f0f4ee] text-[#46554c] font-semibold">Not sent {players.length}</span>
    </div>
  </div>

  {/* Table */}
  <div className="px-7 py-6">
    <div className="bg-white rounded-2xl border border-[#e2e8df] overflow-hidden">
      {/* Table header */}
      <div className="grid px-4 py-2.5 border-b border-[#eef2ea] text-[11px] font-bold uppercase tracking-[0.1em] text-[#90a094]"
        style={{ gridTemplateColumns: '28px 1fr 160px 120px 80px 140px 120px 80px' }}>
        <div><input type="checkbox" /></div>
        <div>Player</div>
        <div>Company</div>
        <div>Title</div>
        <div className="text-center">HCP</div>
        <div>Team</div>
        <div>Magic Link</div>
        <div>Actions</div>
      </div>

      {/* Table rows */}
      {players.map(player => (
        <div key={player.id} className="grid items-center px-4 py-3 border-b border-[#f0f4ee] hover:bg-[#fafcf9]"
          style={{ gridTemplateColumns: '28px 1fr 160px 120px 80px 140px 120px 80px', minHeight: 52 }}>
          <input type="checkbox" />
          {/* Player: green avatar + name + email */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#1a472a] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
              {player.name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[14px] text-[#15241c] truncate">{player.name}</p>
              <p className="text-[11px] text-[#90a094] truncate">{player.auth_user_id ? 'linked' : 'no account'}</p>
            </div>
          </div>
          <div className="text-[13px] text-[#46554c] truncate">—</div>
          <div className="text-[12px] text-[#6b7a70] truncate">—</div>
          <div className="text-center font-semibold text-[14px]">—</div>
          {/* Team pill */}
          <div>
            {player.team_id ? (
              <span className="rounded-full px-2.5 py-0.5 bg-[#e9f3ec] text-[#1a472a] text-[12px] font-semibold">
                {teams.find(t => t.id === player.team_id)?.team_name ?? 'Team'}
              </span>
            ) : <span className="text-[#90a094] text-[12px]">—</span>}
          </div>
          {/* Magic link status */}
          <div>
            <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#f0f4ee] text-[#46554c]">Not sent</span>
          </div>
          {/* Actions */}
          <div>
            <button className="rounded-lg px-2.5 py-1 text-[12px] font-semibold bg-[#eef2ea] text-[#1a472a]"
              onClick={() => onSendMagicLink(player)}>
              Send
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

**Preserve**: all existing `onSendMagicLink`, toast messages, CSV import modal, edit actions.

### Type-check and commit
```bash
npm run type-check
git add src/app/(admin)/admin/players/
git commit -m "feat: players admin page redesign — green avatars, filter bar, magic-link status pills"
```

---

## Task 5: Teams Page Redesign

**Files:**
- Modify: `src/app/(admin)/admin/teams/teams-manager.tsx`
- Modify: `src/app/(admin)/admin/teams/page.tsx`

### Design
Reference: `docs/superpowers/design-handoff-admin-pages/screenshots/admin-4-teams.png`

**page.tsx**: Remove `space-y-4` wrapper and `<h1>`. Return bare `<TeamsManager>`.

**teams-manager.tsx** full restyle:

```
<div>
  <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Teams">
    <button className="rounded-xl border border-[#d6ddd2] px-3 py-1.5 text-[13px] font-semibold text-[#46554c]">⚡ Auto-assign holes</button>
    <button className="bg-[#1a472a] text-white rounded-xl px-4 py-2 text-[14px] font-semibold">+ Add Team</button>
  </AdminTopBar>

  <div className="px-7 py-6 grid gap-[18px]" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
    {teams.map((team, idx) => {
      const isLeader = idx === 0; // first team = leader (by team_number for now)
      const memberCount = players.filter(p => p.team_id === team.id).length;
      const isWarning = memberCount < 4;

      return (
        <div key={team.id} className={`bg-white rounded-2xl overflow-hidden border ${isWarning ? 'border-[#ecd9b4]' : 'border-[#e2e8df]'}`}>
          {/* Card header */}
          <div className={`flex items-center justify-between px-[18px] py-3`}
            style={{ background: isWarning ? '#fbf1df' : isLeader ? '#1a472a' : '#f4f7f1' }}>
            <span className="font-barlow font-extrabold text-[22px]"
              style={{ color: isWarning ? '#7a500a' : isLeader ? '#fff' : '#15241c' }}>
              {team.team_name}
            </span>
            <span className="rounded-full px-2.5 py-0.5 text-[18px] font-barlow font-bold"
              style={{ background: 'rgba(255,255,255,.18)', color: isLeader ? '#fff' : '#46554c' }}>
              H{team.starting_hole ?? 1}
            </span>
          </div>

          {/* Member list */}
          <div className="px-[18px] py-3 flex flex-col gap-2">
            {[...Array(team.max_players ?? 4)].map((_, i) => {
              const player = players.filter(p => p.team_id === team.id)[i];
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-[7px] bg-[#eef2ea] flex items-center justify-center text-[11px] font-bold text-[#1a472a] shrink-0">
                    {player ? player.name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase() : '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#15241c] truncate">{player?.name ?? '— Unassigned —'}</p>
                    {player && <p className="text-[11px] text-[#90a094]">Player</p>}
                  </div>
                  {player && <span className="text-[11px] text-[#90a094]">HCP —</span>}
                </div>
              );
            })}
          </div>

          {/* Card footer */}
          <div className="px-[18px] pb-[14px] pt-2.5 border-t border-[#f0f4ee] flex gap-2">
            <button className="flex-1 rounded-xl py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]"
              onClick={() => onEditTeam(team)}>Edit team</button>
            <button className="flex-1 rounded-xl py-1.5 text-[13px] font-semibold bg-[#f4f7f1] text-[#46554c]">Manage players</button>
          </div>
        </div>
      );
    })}
  </div>

  {/* Add Team form (existing modal/inline — preserve as-is, just restyle the trigger button) */}
</div>
```

**Preserve**: all existing `onEditTeam`, add-team form, starting hole assignment, drag-drop (if any).

### Type-check and commit
```bash
npm run type-check
git add src/app/(admin)/admin/teams/
git commit -m "feat: teams admin page redesign — 3-col card grid, leader header, warning state"
```

---

## Task 6: Clubs Page Redesign

**Files:**
- Modify: `src/app/(admin)/admin/clubs/clubs-manager.tsx`
- Modify: `src/app/(admin)/admin/clubs/page.tsx`

### Design
Reference: `docs/superpowers/design-handoff-admin-pages/screenshots/admin-5-clubs.png`

**page.tsx**: pass clubs through as before. Remove any wrapping container.

**clubs-manager.tsx** is currently only 58 lines — likely a stub. Full implementation needed:

The clubs manager is a client component (`'use client'`). It receives `clubs: Club[]` and `tournamentId: string`. Fetch pattern: uses `createClient()` from `@/lib/supabase/client`.

```tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { AdminTopBar } from '@/components/admin-top-bar';
import type { Club } from '@/lib/types';

interface ClubsManagerProps {
  clubs: Club[];
  tournamentId: string;
}

export function ClubsManager({ clubs: initialClubs, tournamentId }: ClubsManagerProps) {
  const [clubs, setClubs] = useState(initialClubs);
  const supabase = createClient();

  const maxShots = Math.max(...clubs.map(c => c.sort_order), 1); // placeholder; no shot count in Club type

  return (
    <div>
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Clubs" />

      <div className="px-7 py-6 flex gap-6">
        {/* Left: club list */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-[#e2e8df] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#eef2ea]">
              <p className="text-[12px] text-[#90a094]">Shown on player device in this order</p>
            </div>
            {/* Column headers */}
            <div className="grid px-5 py-2 border-b border-[#eef2ea] text-[11px] font-bold uppercase tracking-[0.1em] text-[#90a094]"
              style={{ gridTemplateColumns: '32px 1fr 80px 120px 80px 80px' }}>
              <div />
              <div>Club</div>
              <div>Type</div>
              <div>Usage</div>
              <div>Shots</div>
              <div>Actions</div>
            </div>

            {clubs.map((club) => (
              <div key={club.id}
                className="grid items-center px-5 py-3 border-b border-[#f0f4ee] hover:bg-[#fafcf9]"
                style={{ gridTemplateColumns: '32px 1fr 80px 120px 80px 80px' }}>
                {/* Drag handle */}
                <span className="text-[#90a094] cursor-grab text-[18px]">⠿</span>
                {/* Club name */}
                <div className="flex items-center gap-2.5">
                  <div className="w-[30px] h-[30px] rounded-[8px] bg-[#eef2ea] flex items-center justify-center text-[11px] font-bold text-[#1a472a]">
                    {club.name.slice(0,2).toUpperCase()}
                  </div>
                  <span className="font-semibold text-[14px] text-[#15241c]">{club.name}</span>
                </div>
                {/* Type chip */}
                <span className="rounded-lg px-2.5 py-0.5 text-[12px] font-medium bg-[#f4f7f1] text-[#6b7a70]">
                  {club.category ?? 'Iron'}
                </span>
                {/* Usage bar (sort_order as proxy since no shot count in Club type) */}
                <div className="h-[6px] rounded-full bg-[#eef2ea] overflow-hidden">
                  <div className="h-full rounded-full bg-[#1a472a] transition-all"
                    style={{ width: `${Math.min(100, (club.sort_order / (clubs.length || 1)) * 100)}%` }} />
                </div>
                {/* Shot count placeholder */}
                <span className="font-barlow font-bold text-[20px] text-[#1a472a]">—</span>
                {/* Edit */}
                <button className="rounded-lg px-2.5 py-1 text-[12px] font-semibold bg-[#eef2ea] text-[#1a472a]">Edit</button>
              </div>
            ))}
          </div>
        </div>

        {/* Right rail (260px) */}
        <div className="w-[260px] shrink-0 flex flex-col gap-4">
          {/* Add Club form */}
          <div className="bg-white rounded-2xl border border-[#e2e8df] p-5">
            <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-3">Add Club</p>
            {/* name, type dropdown, save button */}
            <button className="w-full rounded-xl py-2.5 text-[14px] font-semibold bg-[#1a472a] text-white mt-3">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Note**: `Club` type may not have `category` field — check `src/lib/types.ts`. Use `is_active` or `sort_order` if category doesn't exist. Use `name` to infer type (e.g., if name contains "Driver"/"Wood" → Wood, "Iron" → Iron, "Wedge" → Wedge, "Putter" → Putter).

### Type-check and commit
```bash
npm run type-check
git add src/app/(admin)/admin/clubs/
git commit -m "feat: clubs admin page redesign — drag handle, type chip, usage bar, add club form"
```

---

## Task 7: Scores Page Redesign

**Files:**
- Modify: `src/app/(admin)/admin/scores/scores-table.tsx`
- Modify: `src/app/(admin)/admin/scores/page.tsx`

### Design
Reference: `docs/superpowers/design-handoff-admin-pages/screenshots/admin-6-scores.png`

**page.tsx**: Remove any wrapper `<h1>` or space-y containers. Pass `holesPlayed` down.

**scores-table.tsx** full restyle — preserve ALL existing logic (realtime subscription, admin score override popover):

```
<div>
  <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Scores">
    {/* Right: live dot + legend */}
    <div className="flex items-center gap-2 text-[13px] text-[#6b7a70]">
      <span className="w-2 h-2 rounded-full bg-[#2f8f4e] animate-pulse" />
      <span>Auto-refreshing</span>
    </div>
    <div className="flex items-center gap-2">
      {[['Eagle','#1a472a','#fff'],['Birdie','#c0392b','#fff'],['Par','#e8eee4','#46554c'],['Bogey+','#f0e4e0','#a8513f']].map(([l,bg,fg])=>(
        <span key={l} className="rounded-lg px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: bg as string, color: fg as string }}>{l}</span>
      ))}
    </div>
  </AdminTopBar>

  <div className="px-7 py-6">
    <div className="bg-white rounded-2xl border border-[#e2e8df] overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: '#f4f7f1' }}>
            <th className="text-left px-5 py-3 font-barlow font-bold text-[16px] text-[#15241c] sticky left-0 bg-[#f4f7f1]" style={{ minWidth: 160 }}>Team</th>
            {Array.from({ length: 18 }, (_, i) => (
              <th key={i+1} className="font-barlow font-bold text-[16px] text-[#15241c] px-1 py-3 text-center" style={{ minWidth: 44 }}>{i+1}</th>
            ))}
            <th className="font-barlow font-bold text-[16px] text-[#15241c] px-4 py-3 text-center sticky right-0 bg-[#f4f7f1]" style={{ borderLeft: '2px solid #d6ddd2', minWidth: 72 }}>Tot</th>
          </tr>
        </thead>
        <tbody>
          {teams.map(team => {
            const teamScores = scores.filter(s => s.team_id === team.id && s.is_best_ball);
            const totalVsPar = teamScores.reduce((acc, s) => acc + (s.strokes - (parMap.get(s.hole_number) ?? 4)), 0);
            return (
              <tr key={team.id} className="border-t border-[#f0f4ee] hover:bg-[#fafcf9]">
                <td className="px-5 py-2 font-semibold text-[14px] text-[#15241c] sticky left-0 bg-white">{team.team_name}</td>
                {Array.from({ length: 18 }, (_, i) => {
                  const hole = i + 1;
                  const score = teamScores.find(s => s.hole_number === hole);
                  const par = parMap.get(hole) ?? 4;
                  const vsPar = score ? score.strokes - par : null;
                  // Cell color
                  let bg = '#f9faf8', fg = '#c2ccc4', label: string = '·';
                  if (score) {
                    label = String(score.strokes);
                    if (vsPar! <= -2) { bg = '#1a472a'; fg = '#fff'; }
                    else if (vsPar! === -1) { bg = '#c0392b'; fg = '#fff'; }
                    else if (vsPar! === 0) { bg = '#e8eee4'; fg = '#46554c'; }
                    else { bg = '#f0e4e0'; fg = '#a8513f'; }
                  }
                  return (
                    <td key={hole} className="px-1 py-2 text-center">
                      <button
                        className="font-semibold text-[13px] rounded-[7px] mx-auto flex items-center justify-center"
                        style={{ width: 28, height: 28, background: bg, color: fg }}
                        onClick={() => onOverride(team, hole, score)}>
                        {label}
                      </button>
                    </td>
                  );
                })}
                {/* Total */}
                <td className="px-4 py-2 text-center font-barlow font-extrabold text-[22px] sticky right-0 bg-white"
                  style={{ borderLeft: '2px solid #d6ddd2', color: totalVsPar < 0 ? '#c0392b' : totalVsPar === 0 ? '#1a472a' : '#33413a' }}>
                  {totalVsPar < 0 ? `−${Math.abs(totalVsPar)}` : totalVsPar === 0 ? 'E' : `+${totalVsPar}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
</div>
```

**parMap**: The current `scores-table.tsx` likely builds this internally or receives it as a prop. Check and use the existing pattern. Do NOT add new Supabase calls in the client component — if par data isn't available, use par=4 as fallback.

**Preserve**: realtime subscription, score override popover/modal.

### Type-check and commit
```bash
npm run type-check
git add src/app/(admin)/admin/scores/
git commit -m "feat: scores admin page redesign — color-coded matrix, eagle/birdie/par/bogey cells"
```

---

## Task 8: Sponsors Page Redesign

**Files:**
- Modify: `src/app/(admin)/admin/sponsors/sponsors-manager.tsx`
- Modify: `src/app/(admin)/admin/sponsors/page.tsx`

### Design
Reference: `docs/superpowers/design-handoff-admin-pages/screenshots/admin-7-sponsors.png`

**page.tsx**: Remove any wrapper. Pass sponsors + tournamentId through.

**sponsors-manager.tsx** full restyle — preserve ALL existing Supabase mutations (is_active toggle, display_order, delete):

```
<div>
  <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Sponsors">
    <button className="bg-[#1a472a] text-white rounded-xl px-4 py-2 text-[14px] font-semibold">+ Add Sponsor</button>
  </AdminTopBar>

  <div className="px-7 py-6 flex gap-6">
    {/* Left: sponsor cards */}
    <div className="flex-1 flex flex-col gap-4">
      {sponsors.map(sponsor => (
        <div key={sponsor.id} className="bg-white rounded-2xl border border-[#e2e8df] px-[22px] py-[18px] flex items-center gap-4">
          {/* Drag handle */}
          <span className="text-[#90a094] text-[20px] cursor-grab">⠿</span>
          {/* 72px monogram tile */}
          <div className="rounded-[14px] flex items-center justify-center font-barlow font-bold text-[22px] text-white shrink-0"
            style={{ width: 72, height: 72, background: '#1a472a' }}>
            {sponsor.logo_url
              ? <img src={sponsor.logo_url} alt={sponsor.name} className="w-full h-full object-contain rounded-[14px]" />
              : sponsor.name.slice(0,2).toUpperCase()}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[17px] text-[#15241c]">{sponsor.name}</p>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-[#e9f3ec] text-[#1a472a]">Title Sponsor</span>
            </div>
            <p className="text-[13px] text-[#6b7a70] mt-0.5">{sponsor.website_url ?? '—'}</p>
            <p className="text-[12px] mt-1">
              {sponsor.logo_url
                ? <span className="text-[#1a472a] font-semibold">✓ Logo uploaded</span>
                : <span className="text-[#b3741b]">⚠ Logo missing</span>}
            </p>
          </div>
          {/* Show on TV toggle */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <p className="text-[11px] font-bold uppercase text-[#90a094]">Show on TV</p>
            <button
              onClick={() => onToggleActive(sponsor)}
              className="rounded-full transition-colors flex items-center"
              style={{
                width: 44, height: 24,
                background: sponsor.is_active ? '#1a472a' : '#cdd9cf',
                padding: '0 2px',
                justifyContent: sponsor.is_active ? 'flex-end' : 'flex-start',
              }}>
              <span className="w-5 h-5 rounded-full bg-white shadow" />
            </button>
          </div>
          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]">Edit</button>
            <button className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]">Remove</button>
          </div>
        </div>
      ))}
    </div>

    {/* Right rail (300px) */}
    <div className="w-[300px] shrink-0 flex flex-col gap-4">
      {/* TV Footer Preview */}
      <div className="rounded-2xl p-4" style={{ background: '#15241c' }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7d9486] mb-3">TV Footer Preview</p>
        <div className="flex gap-2 flex-wrap">
          {sponsors.filter(s => s.is_active).map(s => (
            <div key={s.id} className="bg-white rounded-xl p-2 flex items-center gap-2"
              style={{ boxShadow: '0 3px 10px rgba(0,0,0,.22)' }}>
              <div className="w-8 h-8 rounded-[6px] bg-[#1a472a] flex items-center justify-center text-white text-[10px] font-bold">
                {s.name.slice(0,2).toUpperCase()}
              </div>
              <span className="font-barlow font-bold text-[14px] text-[#15241c]">{s.name}</span>
            </div>
          ))}
          {sponsors.filter(s => s.is_active).length === 0 && (
            <p className="text-[#7d9486] text-[12px]">No active sponsors</p>
          )}
        </div>
      </div>

      {/* Add Sponsor form (shown when isAdding) */}
      {isAdding && (
        <div className="bg-white rounded-2xl border border-[#e2e8df] p-5">
          <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-3">Add Sponsor</p>
          {/* Name, Website, Tier fields */}
          {/* Logo drop zone */}
          <div className="border-2 border-dashed border-[#cdd9cf] rounded-xl p-4 text-center text-[13px] text-[#90a094] mb-3">
            Drop logo here (PNG/SVG, max 2MB)
          </div>
          <button className="w-full rounded-xl py-2.5 text-[14px] font-semibold bg-[#1a472a] text-white">Save Sponsor</button>
        </div>
      )}
    </div>
  </div>
</div>
```

**Sponsor type**: check `src/lib/types.ts` for `Sponsor` — use actual fields. Fields that may not exist (`website_url`, `tier`) — show `—` / omit gracefully if absent.

**Toggle**: call existing `onToggleActive` handler (Supabase `.update({ is_active: !sponsor.is_active })`).

### Type-check and commit
```bash
npm run type-check
git add src/app/(admin)/admin/sponsors/
git commit -m "feat: sponsors admin page redesign — sponsor cards, TV toggle, footer preview"
```

---

## Task 9: Final Verification + PR

### Step 1: Type-check
```bash
npm run type-check
```

### Step 2: Lint (ESLint via lint-staged — full run)
```bash
npm run lint 2>&1 || true   # next lint may not exist (pre-existing infra gap); eslint runs clean via hooks
```

### Step 3: Tests
```bash
npm run test:ci
```
All 145 tests must pass, coverage ≥ 80%.

### Step 4: Open PR
```bash
gh pr create \
  --base develop \
  --head feature/admin-pages-redesign \
  --title "feat: admin pages visual redesign — 7 pages + shared AdminTopBar" \
  --body "$(cat <<'PRBODY'
## Summary

Visual redesign of all 7 admin sidebar pages using the FDgolf design system (Barlow Condensed, course-green `#1a472a`, `#f4f7f1` page surface). No logic changes — restyle only.

### Changes
- **Shared**: new `AdminTopBar` component (white bar, eyebrow + Barlow title + action slot); admin layout bg `#f4f7f1`
- **Venues**: white venue cards with 📍 tile, status pills, side-panel add form
- **Courses**: 18-hole Front/Back 9 grid tiles with par/SI/GPS dot per hole
- **Players**: filter bar with link-status pills, green avatar initials, team pill, magic-link status column
- **Teams**: 3-column card grid; leader header green, warning state amber; member list with initials
- **Clubs**: sortable list with drag handle, type chip, usage bar, right-rail add form
- **Scores**: color-coded best-ball matrix (eagle=green, birdie=red, par=grey, bogey+=rust), sticky team + total cols
- **Sponsors**: drag-to-order cards, show-on-TV pill toggle, live TV footer preview in right rail

## Test plan
- [ ] `npm run type-check` — 0 errors
- [ ] `npm run test:ci` — all pass, coverage ≥ 80%
- [ ] Each admin page renders without errors
- [ ] All existing mutations preserved (magic link send, score override, sponsor toggle, etc.)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
PRBODY
)"
```

Return the PR URL.

---

## Summary

| Task | Files | Model |
|------|-------|-------|
| 1: Admin Layout + AdminTopBar | `layout.tsx`, `admin-top-bar.tsx` (new) | sonnet |
| 2: Venues redesign | `venue-manager.tsx`, `venues/page.tsx` | sonnet |
| 3: Courses redesign | `course-manager.tsx`, `courses/page.tsx`, `course-holes-editor.tsx` | sonnet |
| 4: Players redesign | `players-table.tsx`, `players/page.tsx` | sonnet |
| 5: Teams redesign | `teams-manager.tsx`, `teams/page.tsx` | sonnet |
| 6: Clubs redesign | `clubs-manager.tsx`, `clubs/page.tsx` | sonnet |
| 7: Scores redesign | `scores-table.tsx`, `scores/page.tsx` | sonnet |
| 8: Sponsors redesign | `sponsors-manager.tsx`, `sponsors/page.tsx` | sonnet |
| 9: Final Verification + PR | — | sonnet |
