# Player Self-Service Magic Link Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Send Magic Link" button to the login page so players can request a sign-in link without needing their password.

**Architecture:** A new public API route checks whether the submitted email belongs to an enrolled player, then calls Supabase `signInWithOtp` to generate and send the magic link. The login page gains a second submit path — `type="button"` so it doesn't trigger form validation — that POSTs to this route and swaps the button for a confirmation message on success.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase JS v2 (`@supabase/supabase-js`), shadcn/ui `Button` + `Input` + `Label`, Tailwind CSS, Jest (`@jest-environment node`).

## Global Constraints

- All new files under `src/` must pass `npm run type-check` (zero errors) and `npm run lint` before committing.
- Test coverage thresholds: ≥80% statements/functions/lines, ≥70% branches (enforced by `npm run test:ci`).
- Commit format: `[TYPE] SHORT-ID: Short imperative description (max 72 chars)` — e.g. `feat: add POST /api/auth/request-link`.
- No `any` types, no `!` non-null assertions without justification.
- Design tokens: primary green `#1a472a`, hover `#143820`, surface `#f4f7f1`. Use existing shadcn `Button` and `Input` components — do not introduce new UI dependencies.
- The API route must always return `200 { ok: true }` for valid email inputs regardless of whether the player exists — anti-enumeration requirement.
- Branch: `feature/US-0036-magic-link-login` off `develop`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/api/auth/request-link/route.ts` | **Create** | Public POST endpoint — checks players table, calls `signInWithOtp` |
| `src/__tests__/api-request-link.test.ts` | **Create** | Unit tests for the new route (3 cases) |
| `src/app/(auth)/login/page.tsx` | **Modify** | Add `linkSent`/`linkLoading` state, `handleSendLink`, second button |

---

### Task 1: `POST /api/auth/request-link` + unit tests

**Files:**
- Create: `src/app/api/auth/request-link/route.ts`
- Create: `src/__tests__/api-request-link.test.ts`

**Interfaces:**
- Produces: `POST /api/auth/request-link` — accepts `{ email: string }`, returns `{ ok: true }` (200) or `{ error: string }` (400/500). Consumed by Task 2's `handleSendLink`.

---

- [ ] **Step 1: Create the branch**

```bash
git checkout develop && git pull && git checkout -b feature/US-0036-magic-link-login
```

- [ ] **Step 2: Write the failing tests**

Create `src/__tests__/api-request-link.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { POST } from '@/app/api/auth/request-link/route';

const mockSignInWithOtp = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    auth: { signInWithOtp: mockSignInWithOtp },
  })),
}));

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, jest.Mock> & { then?: jest.Mock } = {};
  chain.then = jest.fn((onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(onFulfilled)
  );
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(resolvedValue));
  return chain;
}

describe('POST /api/auth/request-link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it('returns 400 when email is missing', async () => {
    const req = new Request('http://localhost/api/auth/request-link', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it('returns 200 without calling signInWithOtp when email is not in players table', async () => {
    const chain = makeChain({ data: null, error: { message: 'No rows' } });
    mockFrom.mockReturnValue(chain);

    const req = new Request('http://localhost/api/auth/request-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'unknown@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('returns 200 and calls signInWithOtp when email matches an enrolled player', async () => {
    const chain = makeChain({ data: { id: 'player-1' }, error: null });
    mockFrom.mockReturnValue(chain);

    const req = new Request('http://localhost/api/auth/request-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'player@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
      options: { shouldCreateUser: false },
    });
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest src/__tests__/api-request-link.test.ts --no-coverage
```

Expected: 3 failures — `Cannot find module '@/app/api/auth/request-link/route'`.

- [ ] **Step 4: Implement the route**

Create `src/app/api/auth/request-link/route.ts`:

```typescript
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email } = body as { email?: string };

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('email', email)
    .single();

  if (player) {
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest src/__tests__/api-request-link.test.ts --no-coverage
```

Expected: 3 passed, 0 failed.

- [ ] **Step 6: Type-check**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/auth/request-link/route.ts src/__tests__/api-request-link.test.ts
git commit -m "feat: add POST /api/auth/request-link — self-service magic link for enrolled players"
```

---

### Task 2: Login page — Send Magic Link button

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/request-link` from Task 1 — called with `{ email }`, always resolves to `{ ok: true }`.

---

- [ ] **Step 1: Replace the login page**

Open `src/app/(auth)/login/page.tsx` and replace its entire contents with:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error('Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: player } = await supabase
        .from('players')
        .select('role')
        .eq('auth_user_id', data.user.id)
        .single();

      if (player?.role === 'system_admin' || player?.role === 'tournament_admin') {
        router.push('/admin/tournament');
        return;
      }
    }

    router.push('/dashboard');
  }

  async function handleSendLink() {
    if (!email) {
      toast.error('Enter your email address first.');
      return;
    }
    setLinkLoading(true);
    await fetch('/api/auth/request-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setLinkLoading(false);
    setLinkSent(true);
  }

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Sign in</h2>

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

      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-[#1a472a] hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      {linkSent ? (
        <p className="rounded-lg border border-[#1a472a] px-4 py-3 text-center text-sm font-medium text-[#1a472a]">
          Check your email for a sign-in link.
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full border-[#1a472a] text-[#1a472a] hover:bg-[#f4f7f1]"
          onClick={handleSendLink}
          disabled={linkLoading}
        >
          {linkLoading ? 'Sending…' : 'Send Magic Link'}
        </Button>
      )}

      <Button
        type="submit"
        className="w-full bg-[#1a472a] hover:bg-[#143820]"
        disabled={loading}
      >
        {loading ? 'Signing in…' : 'Sign In with Password'}
      </Button>

      <p className="text-center text-sm text-gray-500">
        No account?{' '}
        <Link href="/register" className="font-medium text-[#1a472a] hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
```

Key changes from the original:
- `handleSubmit` renamed to `handleSignIn` — no logic change, rename only
- `linkLoading` + `linkSent` state added
- `handleSendLink` — validates email present, POSTs to `/api/auth/request-link`, sets `linkSent`
- "Send Magic Link" button: `type="button"` (won't trigger form validation or submit), swapped for a confirmation message once `linkSent` is true
- "Sign In with Password" button replaces original "Sign in" label

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: zero errors.

- [ ] **Step 3: Run the full test suite**

```bash
npm run test:ci
```

Expected: all tests pass, all coverage thresholds met.

- [ ] **Step 4: Commit**

```bash
git add src/app/(auth)/login/page.tsx
git commit -m "feat: add Send Magic Link button to login page (US-0036)"
```

- [ ] **Step 5: Open PR**

```bash
git push -u origin feature/US-0036-magic-link-login
gh pr create --base develop --title "feat: player self-service magic link login (US-0036)" \
  --body "Adds Send Magic Link button to login page. New POST /api/auth/request-link checks players table then calls signInWithOtp. Password path unchanged. Anti-enumeration: always returns 200."
```
