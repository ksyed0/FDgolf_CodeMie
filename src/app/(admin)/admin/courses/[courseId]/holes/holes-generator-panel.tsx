'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

interface HolesGeneratorPanelProps {
  courseId: string;
  holeCount: number;
}

type HoleRow = { hole_number: number; par: number; handicap: number };

function parseHolesCsv(text: string): { rows: HoleRow[]; error: string | null } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2)
    return { rows: [], error: 'CSV must have a header row and at least one data row.' };

  const header = lines[0]
    .toLowerCase()
    .split(',')
    .map((h) => h.trim());
  const holeIdx = header.indexOf('hole_number');
  const parIdx = header.indexOf('par');
  const hcpIdx = header.indexOf('handicap');

  if (holeIdx === -1 || parIdx === -1) {
    return { rows: [], error: 'CSV must have columns: hole_number, par (handicap optional).' };
  }

  const rows: HoleRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const holeNum = parseInt(cols[holeIdx], 10);
    const par = parseInt(cols[parIdx], 10);
    const handicap = hcpIdx !== -1 && cols[hcpIdx] ? parseInt(cols[hcpIdx], 10) : holeNum;

    if (isNaN(holeNum) || holeNum < 1 || holeNum > 18) {
      return { rows: [], error: `Row ${i + 1}: hole_number must be 1–18.` };
    }
    if (isNaN(par) || par < 3 || par > 5) {
      return { rows: [], error: `Row ${i + 1}: par must be 3, 4, or 5.` };
    }
    if (isNaN(handicap) || handicap < 1 || handicap > 18) {
      return { rows: [], error: `Row ${i + 1}: handicap must be 1–18.` };
    }
    rows.push({ hole_number: holeNum, par, handicap });
  }
  return { rows, error: null };
}

export function HolesGeneratorPanel({ courseId, holeCount }: HolesGeneratorPanelProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const supabase = createClient();

  async function generateHoles() {
    setGenerating(true);
    const rows = Array.from({ length: holeCount }, (_, i) => ({
      course_id: courseId,
      hole_number: i + 1,
      par: 4,
      handicap: i + 1,
      pin_lat: 0,
      pin_lng: 0,
    }));
    const { error } = await supabase.from('holes').insert(rows);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Generated ${holeCount} holes. Edit par, handicap, and pins below.`);
      router.refresh();
    }
    setGenerating(false);
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const text = await file.text();
    const { rows, error } = parseHolesCsv(text);
    if (error) {
      toast.error(error);
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    const inserts = rows.map((r) => ({
      course_id: courseId,
      hole_number: r.hole_number,
      par: r.par,
      handicap: r.handicap,
      pin_lat: 0,
      pin_lng: 0,
    }));

    const { error: insertError } = await supabase.from('holes').insert(inserts);
    if (insertError) {
      toast.error(insertError.message);
    } else {
      toast.success(`Imported ${rows.length} holes from CSV.`);
      router.refresh();
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
      <p className="mb-1 text-sm font-medium text-gray-700">No holes configured yet</p>
      <p className="mb-4 text-xs text-gray-500">
        Generate {holeCount} default holes (par 4, edit after), or import from CSV.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={generateHoles}
          disabled={generating}
          className="bg-[#1a472a] hover:bg-[#143820]"
          size="sm"
        >
          {generating ? 'Generating…' : `Generate ${holeCount} Holes`}
        </Button>

        <label className="cursor-pointer">
          <span
            className={[
              'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground',
              importing ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
          >
            {importing ? 'Importing…' : 'Import from CSV'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={handleCsvUpload}
            disabled={importing}
          />
        </label>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        CSV columns: <code className="rounded bg-gray-100 px-1">hole_number, par, handicap</code>{' '}
        (handicap optional — defaults to hole order)
      </p>
    </div>
  );
}
