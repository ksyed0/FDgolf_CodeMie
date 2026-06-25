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

      <Button type="submit" className="w-full bg-[#1a472a] hover:bg-[#143820]" disabled={loading}>
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
