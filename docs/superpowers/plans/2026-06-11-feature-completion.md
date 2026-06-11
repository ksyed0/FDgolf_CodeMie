# Feature Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 missing features (logout, add team, tournament name edit, copy URL, hole summary, edit shot, password reset) so the app is fully testable locally before cloud deployment.

**Architecture:** All features are additive changes to existing pages/components using the established pattern (Supabase JS client + shadcn/ui + sonner toasts). Features 4 and 5 both modify `round/page.tsx` and must be done in order. No new migrations or API routes required.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui (Button, Input, Select), Supabase JS client (`@supabase/ssr`), lucide-react icons, sonner toasts.

**Spec:** `docs/superpowers/specs/2026-06-11-feature-completion-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/sign-out-button.tsx` | Client component: sign out + redirect |
| Modify | `src/app/(player)/layout.tsx` | Add SignOutButton as 5th nav item |
| Modify | `src/app/(admin)/admin/teams/teams-manager.tsx` | Add team creation form |
| Modify | `src/app/(admin)/admin/teams/page.tsx` | Pass `tournamentId` prop |
| Create | `src/app/(admin)/admin/tournament/tournament-name-editor.tsx` | Click-to-edit name component |
| Modify | `src/app/(admin)/admin/tournament/tournament-controls.tsx` | Add `slug` prop + Copy URL button |
| Modify | `src/app/(admin)/admin/tournament/page.tsx` | Wire up both new components |
| Modify | `src/app/(player)/round/page.tsx` | Hole summary + edit shot (Features 4 & 5) |
| Create | `src/app/(auth)/forgot-password/page.tsx` | Email form → Supabase reset email |
| Create | `src/app/(auth)/reset-password/page.tsx` | New password form → `updateUser` |
| Modify | `src/app/(auth)/login/page.tsx` | Add "Forgot password?" link |

---

## Task 1: SignOutButton component

**Files:**
- Create: `src/components/sign-out-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Could not sign out. Please try again.');
      return;
    }
    router.push('/login');
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
    >
      <LogOut className="h-5 w-5" />
      <span className="text-[10px]">Sign out</span>
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sign-out-button.tsx
git commit -m "feat: add SignOutButton client component"
```

---

## Task 2: Add Sign Out tab to player bottom nav

**Files:**
- Modify: `src/app/(player)/layout.tsx`

- [ ] **Step 1: Add import and 5th nav item**

Open `src/app/(player)/layout.tsx`. Add the `SignOutButton` import after the existing imports:

```tsx
import { SignOutButton } from '@/components/sign-out-button';
```

Replace the closing `</div>` of the nav items section — the section that ends with the Scorecard link — by appending `<SignOutButton />` as the 5th child:

```tsx
        <div className="mx-auto flex max-w-md items-center justify-around py-2">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px]">Home</span>
          </Link>
          <Link
            href="/round"
            className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
          >
            <Flag className="h-5 w-5" />
            <span className="text-[10px]">Round</span>
          </Link>
          <Link
            href="/leaderboard"
            className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
          >
            <Trophy className="h-5 w-5" />
            <span className="text-[10px]">Leaders</span>
          </Link>
          <Link
            href="/scorecard"
            className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#1a472a]"
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-[10px]">Scorecard</span>
          </Link>
          <SignOutButton />
        </div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

Log in as `alice@fdgolf.local` / `Password1!`. Navigate to any player page. Verify the bottom nav has 5 items and the Sign Out tab is visible. Tap it — verify redirect to `/login` and you are no longer authenticated (visiting `/dashboard` redirects back to `/login`).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(player\)/layout.tsx
git commit -m "feat: add Sign Out tab to player bottom nav"
```

---

## Task 3: Add Team button + inline form in TeamsManager

**Files:**
- Modify: `src/app/(admin)/admin/teams/teams-manager.tsx`
- Modify: `src/app/(admin)/admin/teams/page.tsx`

- [ ] **Step 1: Update the page to pass `tournamentId`**

Open `src/app/(admin)/admin/teams/page.tsx`. Change the `<TeamsManager>` usage to pass `tournamentId`:

```tsx
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
      <TeamsManager
        teams={(teams as Team[]) ?? []}
        players={(players as Player[]) ?? []}
        tournamentId={tournament?.id ?? ''}
      />
    </div>
  );
```

- [ ] **Step 2: Update TeamsManager props and add state**

Open `src/app/(admin)/admin/teams/teams-manager.tsx`. Replace the `TeamsManagerProps` interface and add new state inside the component:

```tsx
interface TeamsManagerProps {
  teams: Team[];
  players: Player[];
  tournamentId: string;
}

export function TeamsManager({ teams: initialTeams, players, tournamentId }: TeamsManagerProps) {
  const [teams, setTeams] = useState(initialTeams);
  const [teamNames, setTeamNames] = useState<Record<string, string>>(
    Object.fromEntries(initialTeams.map((t) => [t.id, t.team_name ?? '']))
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ team_name: '', starting_hole: 1, max_players: 4 });
  const [adding, setAdding] = useState(false);
  const supabase = createClient();
```

- [ ] **Step 3: Add `addTeam` function**

Add this function inside `TeamsManager`, after `assignPlayer`:

```tsx
  async function addTeam() {
    setAdding(true);
    const nextNumber =
      teams.length > 0 ? Math.max(...teams.map((t) => t.team_number)) + 1 : 1;
    const { data, error } = await supabase
      .from('teams')
      .insert({
        tournament_id: tournamentId,
        team_number: nextNumber,
        team_name: addForm.team_name.trim() || null,
        starting_hole: addForm.starting_hole,
        max_players: addForm.max_players,
      })
      .select()
      .single<Team>();
    if (error) {
      toast.error(error.message);
    } else if (data) {
      setTeams((prev) => [...prev, data]);
      setTeamNames((prev) => ({ ...prev, [data.id]: data.team_name ?? '' }));
      setAddForm({ team_name: '', starting_hole: 1, max_players: 4 });
      setShowAddForm(false);
      toast.success('Team added');
    }
    setAdding(false);
  }
```

- [ ] **Step 4: Add Add Team button and form to the JSX**

At the top of the `return (` block, before the `{teams.map(...)}` section, add:

```tsx
    <div className="space-y-4">
      {/* Add Team */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          className="border-[#1a472a] text-[#1a472a] hover:bg-[#1a472a] hover:text-white"
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? 'Cancel' : '+ Add Team'}
        </Button>
      </div>

      {showAddForm && (
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-gray-900">New Team</h3>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Team name (optional)"
              value={addForm.team_name}
              onChange={(e) => setAddForm((f) => ({ ...f, team_name: e.target.value }))}
              className="flex-1 min-w-[160px]"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Starting hole</label>
              <Input
                type="number"
                min={1}
                max={18}
                value={addForm.starting_hole}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, starting_hole: Number(e.target.value) }))
                }
                className="w-16"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Max</label>
              <Select
                value={String(addForm.max_players)}
                onValueChange={(v) => setAddForm((f) => ({ ...f, max_players: Number(v) }))}
              >
                <SelectTrigger className="h-8 w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="bg-[#1a472a] hover:bg-[#143820]"
            onClick={addTeam}
            disabled={adding || !addForm.starting_hole || addForm.starting_hole < 1 || addForm.starting_hole > 18}
          >
            {adding ? 'Adding…' : 'Add Team'}
          </Button>
        </div>
      )}

      {/* existing team cards below... */}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 6: Manual test**

Log in as `admin@fdgolf.local` / `Password1!`. Navigate to `/admin/teams`. Click "+ Add Team". Fill in starting hole = 5, leave name blank, click "Add Team". Verify a new team card appears with `team_number` one higher than the current max and `Starting hole: 5`.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(admin\)/admin/teams/teams-manager.tsx src/app/\(admin\)/admin/teams/page.tsx
git commit -m "feat: add team creation form to TeamsManager"
```

---

## Task 4: TournamentNameEditor component

**Files:**
- Create: `src/app/(admin)/admin/tournament/tournament-name-editor.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TournamentNameEditorProps {
  tournamentId: string;
  initialName: string;
}

export function TournamentNameEditor({ tournamentId, initialName }: TournamentNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('tournaments')
      .update({ name: trimmed })
      .eq('id', tournamentId);
    if (error) {
      toast.error(error.message);
    } else {
      setName(trimmed);
      setEditing(false);
      toast.success('Name saved');
    }
    setSaving(false);
  }

  function cancel() {
    setDraft(name);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="max-w-sm text-xl font-semibold h-9"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={save}
          disabled={saving || !draft.trim()}
          aria-label="Save name"
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" onClick={cancel} aria-label="Cancel">
          <X className="h-4 w-4 text-gray-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <h2 className="text-xl font-semibold">{name}</h2>
      <button
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Edit tournament name"
      >
        <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/tournament/tournament-name-editor.tsx
git commit -m "feat: add TournamentNameEditor click-to-edit component"
```

---

## Task 5: Add Copy URL button to TournamentControls

**Files:**
- Modify: `src/app/(admin)/admin/tournament/tournament-controls.tsx`

- [ ] **Step 1: Add `slug` prop and Copy URL button**

Replace the entire file content with:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import type { Tournament, TournamentStatus } from '@/lib/types';

interface TournamentControlsProps {
  tournament: Tournament;
  slug: string;
}

const STATUS_MESSAGES: Partial<Record<TournamentStatus, string>> = {
  active: 'Tournament activated!',
  paused: 'Tournament paused.',
  completed: 'Tournament completed!',
};

export function TournamentControls({ tournament, slug }: TournamentControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: TournamentStatus) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('tournaments')
      .update({ status: newStatus })
      .eq('id', tournament.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(STATUS_MESSAGES[newStatus] ?? 'Status updated');
      router.refresh();
    }
    setLoading(false);
  }

  function copyLiveUrl() {
    const url = `${window.location.origin}/live/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copied!'),
      () => toast.error('Could not copy to clipboard')
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={copyLiveUrl}>
        <Copy className="mr-2 h-4 w-4" />
        Copy live URL
      </Button>

      {tournament.status === 'setup' && (
        <Button
          className="bg-[#1a472a] hover:bg-[#143820]"
          onClick={() => updateStatus('active')}
          disabled={loading}
        >
          Activate Tournament
        </Button>
      )}
      {tournament.status === 'active' && (
        <>
          <Button
            variant="outline"
            className="border-amber-500 text-amber-700 hover:bg-amber-50"
            onClick={() => updateStatus('paused')}
            disabled={loading}
          >
            Pause Tournament
          </Button>
          <Button
            variant="destructive"
            onClick={() => updateStatus('completed')}
            disabled={loading}
          >
            Complete Tournament
          </Button>
        </>
      )}
      {tournament.status === 'paused' && (
        <>
          <Button
            className="bg-[#1a472a] hover:bg-[#143820]"
            onClick={() => updateStatus('active')}
            disabled={loading}
          >
            Resume Tournament
          </Button>
          <Button
            variant="destructive"
            onClick={() => updateStatus('completed')}
            disabled={loading}
          >
            Complete Tournament
          </Button>
        </>
      )}
      {tournament.status === 'completed' && (
        <p className="text-sm text-gray-500">Tournament is complete.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors. (Will fail until Task 6 passes `slug` from the page — that's fine, fix in next task.)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/tournament/tournament-controls.tsx
git commit -m "feat: add Copy live URL button to TournamentControls"
```

---

## Task 6: Wire up TournamentNameEditor and slug in tournament admin page

**Files:**
- Modify: `src/app/(admin)/admin/tournament/page.tsx`

- [ ] **Step 1: Replace static name heading and pass slug**

Replace the entire file content with:

```tsx
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import type { Tournament } from '@/lib/types';
import { TournamentControls } from './tournament-controls';
import { TournamentNameEditor } from './tournament-name-editor';

const STATUS_LABELS: Record<string, string> = {
  setup: 'Not started',
  active: 'In progress',
  completed: 'Completed',
};

export default async function TournamentAdminPage() {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single<Tournament>();

  if (!tournament) {
    return <p className="text-gray-500">No tournament found.</p>;
  }

  const [{ count: playerCount }, { count: teamCount }] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }),
    supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tournament</h1>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <TournamentNameEditor
              tournamentId={tournament.id}
              initialName={tournament.name}
            />
            <p className="text-sm text-gray-500">{tournament.venue}</p>
            <p className="text-sm text-gray-500">
              {new Date(tournament.date).toLocaleDateString('en-CA', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="mt-1 text-sm text-gray-500">Format: {tournament.format}</p>
          </div>
          <Badge variant={tournament.status === 'active' ? 'default' : 'secondary'}>
            {STATUS_LABELS[tournament.status] ?? tournament.status}
          </Badge>
        </div>

        <div className="mt-4 flex gap-6 border-t pt-4 text-sm">
          <div>
            <p className="font-semibold text-gray-900">{playerCount ?? 0}</p>
            <p className="text-gray-500">Players</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{teamCount ?? 0}</p>
            <p className="text-gray-500">Teams</p>
          </div>
        </div>
      </div>

      <TournamentControls tournament={tournament} slug={tournament.slug} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 3: Manual test**

Log in as `admin@fdgolf.local`. Navigate to `/admin/tournament`. Hover over the tournament name — pencil icon appears. Click it, edit the name, press Enter or click ✓ — verify name persists after page refresh. Click "Copy live URL" — verify clipboard contains `http://localhost:3000/live/<slug>` (check with toast confirmation).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/tournament/page.tsx
git commit -m "feat: wire up TournamentNameEditor and Copy URL in tournament admin"
```

---

## Task 7: Hole Summary card in round page

**Files:**
- Modify: `src/app/(player)/round/page.tsx`

- [ ] **Step 1: Add new state variables**

In `src/app/(player)/round/page.tsx`, after the existing state declarations (around line 41), add:

```tsx
  const [holeSummaryScores, setHoleSummaryScores] = useState<Score[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
```

- [ ] **Step 2: Fetch summary scores when hole is sunk**

Inside `recordShot`, find where `setHoleSunk(true)` is called (around line 199). Add the fetch **after** `setHoleSunk(true)`:

```tsx
        setHoleSunk(true);

        // Fetch all teammates' scores for the hole summary
        setSummaryLoading(true);
        const { data: summaryData } = await supabase
          .from('scores')
          .select('*')
          .eq('tournament_id', tournament.id)
          .eq('hole_number', roundState.current_hole)
          .in('player_id', teammates.map((p) => p.id));
        setHoleSummaryScores((summaryData as Score[]) ?? []);
        setSummaryLoading(false);
```

- [ ] **Step 3: Reset summary state in nextHole**

Inside the `nextHole` callback, find where `setHoleSunk(false)` is called (around line 238). Add resets after it:

```tsx
    setHoleSunk(false);
    setHoleSummaryScores([]);
    setSummaryLoading(false);
```

- [ ] **Step 4: Replace the hole-complete card**

Find the existing hole-complete card (the block starting with `<div className="space-y-3 rounded-xl border bg-white p-4 text-center shadow-sm">` around line 314). Replace the **entire** ternary block from `{!holeSunk ? (` through the closing `)}`  with:

```tsx
        {!holeSunk ? (
          <ShotOutcomeButtons
            onOutcome={recordShot}
            disabled={recording || !selectedClub || !activePlayerId}
          />
        ) : (
          <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-center text-lg font-bold text-[#1a472a]">
              ⛳ Hole {currentHole.hole_number} Complete
            </p>

            {summaryLoading ? (
              <p className="text-center text-sm text-gray-500">Calculating…</p>
            ) : (
              <>
                {(() => {
                  const bestStrokes =
                    holeSummaryScores.length > 0
                      ? Math.min(...holeSummaryScores.map((s) => s.strokes))
                      : null;
                  const bestBallPar =
                    bestStrokes !== null ? bestStrokes - currentHole.par : null;
                  return (
                    <>
                      {bestBallPar !== null && (
                        <p className="text-center text-sm text-gray-600">
                          Best Ball: {bestStrokes} strokes (
                          {bestBallPar >= 0 ? '+' : ''}
                          {bestBallPar} vs par)
                        </p>
                      )}
                      <div className="space-y-1.5">
                        {teammates.map((p) => {
                          const score = holeSummaryScores.find((s) => s.player_id === p.id);
                          const isBest = score !== undefined && score.strokes === bestStrokes;
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                                isBest
                                  ? 'border border-green-500 bg-green-50 font-bold text-green-700'
                                  : 'border border-gray-200 bg-gray-50 text-gray-700'
                              }`}
                            >
                              <span>{p.name}</span>
                              <span>
                                {score
                                  ? `${score.strokes} strokes${isBest ? ' ★' : ''}`
                                  : '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </>
            )}

            <Button className="w-full bg-[#1a472a] hover:bg-[#143820]" onClick={nextHole}>
              Next Hole →
            </Button>
          </div>
        )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 6: Manual test**

Log in as `alice@fdgolf.local`. Go to `/round`. Record shots for Hole 1. On the final shot select "Sunk!". Verify the card shows all teammates' names, scores where recorded, best ball row highlighted in green with ★. Click "Next Hole →" — verify the summary disappears and shot controls appear for Hole 2.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(player\)/round/page.tsx
git commit -m "feat: hole summary card with teammate scores and best ball highlight"
```

---

## Task 8: Edit Shot inline history

**Files:**
- Modify: `src/app/(player)/round/page.tsx`

- [ ] **Step 1: Add new state variables**

After the `holeSummaryScores` state declarations added in Task 7, add:

```tsx
  const [dbShots, setDbShots] = useState<Shot[]>([]);
  const [editingShot, setEditingShot] = useState<string | null>(null);
  const [editClub, setEditClub] = useState('');
  const [editOutcome, setEditOutcome] = useState<ShotOutcome>('in_play');
```

- [ ] **Step 2: Add outcome label map**

Add this constant near the top of the file, after the imports:

```tsx
const OUTCOME_LABELS: Record<ShotOutcome, string> = {
  in_play: 'In Play',
  out_of_bounds: 'OOB',
  mulligan: 'Mulligan',
  sunk: 'Sunk',
};
```

- [ ] **Step 3: Add `loadDbShots` helper and call it after data loads**

Inside `loadData()`, after `setLoading(false)`, add:

```tsx
      // Load shots for the current hole
      if (rsData && tournamentData) {
        const startHole = rsData.current_hole;
        const allPlayerIds = (teammateData as Player[])?.map((p) => p.id) ?? [];
        if (allPlayerIds.length > 0) {
          const { data: shotData } = await supabase
            .from('shots')
            .select('*')
            .eq('tournament_id', tournamentData.id)
            .eq('hole_number', startHole)
            .in('player_id', allPlayerIds)
            .order('shot_number');
          setDbShots((shotData as Shot[]) ?? []);
        }
      }
```

- [ ] **Step 4: Refresh dbShots after each recorded shot**

Inside `recordShot`, after `setRecording(false)` (the last line of the callback), add:

```tsx
      // Refresh shot history
      if (tournament && roundState) {
        const { data: refreshed } = await supabase
          .from('shots')
          .select('*')
          .eq('tournament_id', tournament.id)
          .eq('hole_number', roundState.current_hole)
          .in('player_id', teammates.map((p) => p.id))
          .order('shot_number');
        setDbShots((refreshed as Shot[]) ?? []);
      }
```

- [ ] **Step 5: Reset edit state in nextHole**

Inside `nextHole`, after `setHoleSummaryScores([])` added in Task 7, add:

```tsx
    setDbShots([]);
    setEditingShot(null);
```

- [ ] **Step 6: Add "This hole" section to the JSX**

In the JSX, find the club selector section that starts with:
```tsx
        {/* Club selector */}
        <div>
```

**Before** that block, insert the shot history section:

```tsx
        {/* Shot history */}
        {dbShots.length > 0 && !holeSunk && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              This hole
            </p>
            <div className="space-y-1.5">
              {dbShots.map((shot) => {
                const shooter = teammates.find((p) => p.id === shot.player_id);
                const isEditing = editingShot === shot.id;
                return (
                  <div
                    key={shot.id}
                    className="overflow-hidden rounded-lg border bg-white shadow-sm"
                  >
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => {
                        if (isEditing) {
                          setEditingShot(null);
                        } else {
                          setEditingShot(shot.id);
                          setEditClub(shot.club_name);
                          setEditOutcome(
                            shot.outcome === 'sunk' ? 'in_play' : shot.outcome
                          );
                        }
                      }}
                    >
                      <span className="text-gray-700">
                        Shot {shot.shot_number} · {shooter?.name ?? 'Unknown'} ·{' '}
                        {shot.club_name} · {OUTCOME_LABELS[shot.outcome]}
                      </span>
                      <span className="text-xs text-[#1a472a]">
                        {isEditing ? '✕' : '✏'}
                      </span>
                    </button>

                    {isEditing && (
                      <div className="space-y-3 border-t bg-gray-50 px-3 py-3">
                        <ClubSelector
                          clubs={clubs}
                          value={editClub}
                          onChange={setEditClub}
                        />
                        <div className="flex gap-2">
                          {(['in_play', 'out_of_bounds', 'mulligan'] as ShotOutcome[]).map(
                            (o) => (
                              <button
                                key={o}
                                onClick={() => setEditOutcome(o)}
                                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                                  editOutcome === o
                                    ? 'border-[#1a472a] bg-[#1a472a] text-white'
                                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {OUTCOME_LABELS[o]}
                              </button>
                            )
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setEditingShot(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 bg-[#1a472a] hover:bg-[#143820]"
                            onClick={async () => {
                              const { error } = await supabase
                                .from('shots')
                                .update({ club_name: editClub, outcome: editOutcome })
                                .eq('id', shot.id);
                              if (error) {
                                toast.error(error.message);
                                return;
                              }
                              setDbShots((prev) =>
                                prev.map((s) =>
                                  s.id === shot.id
                                    ? { ...s, club_name: editClub, outcome: editOutcome }
                                    : s
                                )
                              );
                              setEditingShot(null);
                              toast.success('Shot updated');
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 8: Manual test**

Log in as `alice@fdgolf.local`. Go to `/round`. Record Shot 1 (any club, In Play). Verify the "This hole" section appears above the club selector with "Shot 1 · Alice · [club] · In Play". Tap the ✏ icon — verify an edit panel appears with the club selector and 3 outcome buttons (In Play, OOB, Mulligan — not Sunk). Change the club and outcome, tap Save. Verify the row updates. Tap ✕ to close without saving.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(player\)/round/page.tsx
git commit -m "feat: inline shot history and edit panel on round page"
```

---

## Task 9: Forgot Password page

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/reset-password`;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    // Always show success — never reveal whether email exists
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Check your email</h2>
        <p className="text-sm text-gray-600">
          If <strong>{email}</strong> is registered, you'll receive a password reset link
          shortly.
        </p>
        <Link href="/login" className="text-sm font-medium text-[#1a472a] hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Reset your password</h2>
      <p className="text-sm text-gray-600">
        Enter your email and we'll send you a reset link.
      </p>

      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-[#1a472a] hover:bg-[#143820]"
        disabled={loading}
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-[#1a472a] hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/forgot-password/page.tsx
git commit -m "feat: forgot password page with Supabase reset email"
```

---

## Task 10: Reset Password page

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success('Password updated. You are now signed in.');
    router.push('/dashboard');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Set new password</h2>

      <div className="space-y-1">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-[#1a472a] hover:bg-[#143820]"
        disabled={loading}
      >
        {loading ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/reset-password/page.tsx
git commit -m "feat: reset password page using supabase.auth.updateUser"
```

---

## Task 11: Add "Forgot password?" link to login page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Add link below the password field**

In `src/app/(auth)/login/page.tsx`, find the password `<div className="space-y-1">` block. After its closing `</div>`, add:

```tsx
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-[#1a472a] hover:underline">
          Forgot password?
        </Link>
      </div>
```

`Link` is already imported from `'next/link'` in this file.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 3: Manual test**

Navigate to `http://localhost:3000/login`. Verify "Forgot password?" link appears below the password field. Click it — verify you land on `/forgot-password`. Enter `alice@fdgolf.local`, submit. Open Inbucket at `http://127.0.0.1:54344`, find the reset email, click the link — verify you land on `/reset-password`. Enter a new password (≥8 chars), submit — verify redirect to `/dashboard`.

- [ ] **Step 4: Run full test suite to confirm nothing regressed**

```bash
npm run test:ci
```

Expected: all tests pass, coverage ≥80%.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx
git commit -m "feat: add Forgot password link to login page"
```

---

## Task 12: Un-skip E2E tests for newly implemented features

**Files:**
- Modify: `tests/e2e/admin.spec.ts`

- [ ] **Step 1: Un-skip TC-0049 (tournament name edit) and TC-0050 (copy URL)**

Open `tests/e2e/admin.spec.ts`. Find the tests for TC-0049 and TC-0050 — they are currently marked with `.skip`. Remove the `.skip` from both. Run them:

```bash
npx playwright test tests/e2e/admin.spec.ts --grep "TC-0049|TC-0050" --reporter=line
```

Expected: both pass. If a selector is wrong, update the test to match the actual rendered element (e.g., the pencil button `aria-label="Edit tournament name"`, the copy button text "Copy live URL").

- [ ] **Step 2: Un-skip TC-0056 (Add Team button)**

Find TC-0056 in `tests/e2e/admin.spec.ts`. Remove `.skip`. Run it:

```bash
npx playwright test tests/e2e/admin.spec.ts --grep "TC-0056" --reporter=line
```

Expected: passes. If the test looks for a button with text "Add Team", ensure the selector matches `'+ Add Team'` as rendered, or update the test.

- [ ] **Step 3: Run the full E2E suite**

```bash
npx playwright test --reporter=line
```

Expected: 34 passed, 2 skipped (TC-0045 — no sponsor logo; TC-0058 — Radix Select), 0 failed.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/admin.spec.ts
git commit -m "test: un-skip TC-0049, TC-0050, TC-0056 after feature implementation"
```

---

## Task 13: Open PR and final checks

- [ ] **Step 1: Verify full build passes**

```bash
npm run build
```

Expected: all routes compile, no TypeScript errors.

- [ ] **Step 2: Run unit tests**

```bash
npm run test:ci
```

Expected: 68+ tests pass, coverage ≥80% statements/functions/lines, ≥70% branches.

- [ ] **Step 3: Open PR to develop**

```bash
git push origin HEAD
gh pr create \
  --title "feat: feature completion — logout, add team, tournament controls, hole summary, edit shot, password reset" \
  --body "$(cat <<'EOF'
## Summary
- Logout: Sign Out tab added to player bottom nav (5th item, client-side `supabase.auth.signOut()`)
- Add Team: inline form in TeamsManager with name, starting hole, max players
- Tournament controls: click-to-edit tournament name + Copy live URL button
- Hole Summary: full teammate score card with best ball highlight after sinking
- Edit Shot: inline shot history above club selector with expandable edit panel
- Password Reset: `/forgot-password` + `/reset-password` pages via Supabase `resetPasswordForEmail`

## Test plan
- [ ] Sign out from player layout → redirects to login
- [ ] Create a team in admin → appears in list with correct team_number
- [ ] Edit tournament name → persists after refresh
- [ ] Copy live URL → clipboard contains `/live/<slug>`
- [ ] Complete a hole → summary shows all teammates, best ball highlighted
- [ ] Edit a shot → club/outcome updated, sunk not available as edit option
- [ ] Forgot password → reset email in Inbucket → set new password → login works
- [ ] `npm run test:ci` passes
- [ ] `npx playwright test` passes (34 passed, 2 skipped)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run type-check` | TypeScript check (no emit) |
| `npm run test:ci` | Jest with coverage |
| `npx playwright test` | Full E2E suite |
| `http://127.0.0.1:54344` | Inbucket (local email testing) |
| `http://127.0.0.1:54343` | Supabase Studio (local DB) |
| `admin@fdgolf.local` / `Password1!` | Admin test user |
| `alice@fdgolf.local` / `Password1!` | Player test user |
