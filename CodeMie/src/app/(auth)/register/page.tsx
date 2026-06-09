'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    title: '',
    company: '',
    email: '',
    phone: '',
    password: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    // Step 1: Create auth user
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError || !data.user) {
      toast.error(authError?.message ?? 'Registration failed');
      setLoading(false);
      return;
    }

    // Step 2: Insert player profile
    const { error: profileError } = await supabase.from('players').insert({
      auth_user_id: data.user.id,
      name: form.name,
      title: form.title,
      company: form.company,
      email: form.email,
      phone: form.phone,
    });

    if (profileError) {
      toast.error('Account created but profile setup failed. Please contact an admin.');
      setLoading(false);
      return;
    }

    toast.success('Account created! Welcome to FDgolf.');
    router.push('/dashboard');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Create account</h2>

      <div className="space-y-1">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required value={form.name} onChange={handleChange} placeholder="Jane Smith" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="title">Job title</Label>
          <Input id="title" name="title" value={form.title} onChange={handleChange} placeholder="Director" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" value={form.company} onChange={handleChange} placeholder="CIBC" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={handleChange} placeholder="you@example.com" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+1 416 555 0100" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={handleChange} placeholder="min 8 characters" />
      </div>

      <Button type="submit" className="w-full bg-[#1a472a] hover:bg-[#143820]" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[#1a472a] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
