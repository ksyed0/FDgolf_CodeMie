'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface ParsedRow {
  name: string;
  email: string;
  company: string;
  title: string;
  team: string;
  starting_hole: number;
  error?: string;
}

interface ImportResult {
  imported: number;
  errors: { row: number; email: string; error: string }[];
  teamsCreated: string[];
  invites: { name: string; email: string; link: string }[];
}

interface CsvImportProps {
  tournamentId: string;
  onClose: () => void;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');
  const companyIdx = headers.indexOf('company');
  const titleIdx = headers.indexOf('title');
  const teamIdx = headers.indexOf('team');
  const holeIdx = headers.findIndex((h) => h === 'starting_hole' || h === 'hole');

  if (nameIdx === -1 || emailIdx === -1) {
    return [
      {
        name: '',
        email: '',
        company: '',
        title: '',
        team: '',
        starting_hole: 1,
        error: 'CSV must have "name" and "email" columns',
      },
    ];
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const name = cols[nameIdx]?.trim() ?? '';
    const email = cols[emailIdx]?.trim() ?? '';
    const company = companyIdx >= 0 ? (cols[companyIdx]?.trim() ?? '') : '';
    const title = titleIdx >= 0 ? (cols[titleIdx]?.trim() ?? '') : '';
    const team = teamIdx >= 0 ? (cols[teamIdx]?.trim() ?? '') : '';
    const starting_hole = holeIdx >= 0 ? parseInt(cols[holeIdx] ?? '1', 10) || 1 : 1;

    let error: string | undefined;
    if (!name) error = 'Missing name';
    else if (!email) error = 'Missing email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Invalid email';

    rows.push({ name, email, company, title, team, starting_hole, error });
  }

  // Check for duplicate emails within the CSV
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.error) continue;
    const lower = row.email.toLowerCase();
    if (seen.has(lower)) {
      row.error = 'Duplicate email in CSV';
    } else {
      seen.add(lower);
    }
  }

  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function CsvImport({ tournamentId, onClose }: CsvImportProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCSV(text));
      setResult(null);
    };
    reader.readAsText(file);
  }

  async function doImport() {
    const validRows = rows.filter((r) => !r.error);
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/admin/import-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          rows: validRows.map((r) => ({
            name: r.name,
            email: r.email,
            company: r.company || undefined,
            title: r.title || undefined,
            team: r.team || undefined,
            starting_hole: r.starting_hole,
          })),
        }),
      });
      const json = (await res.json()) as ImportResult;
      setResult(json);
      if (json.imported > 0) {
        toast.success(`${json.imported} players imported`);
        router.refresh();
      }
      if (json.errors.length > 0) {
        toast.error(`${json.errors.length} rows failed`);
      }
    } catch {
      toast.error('Import request failed');
    } finally {
      setImporting(false);
    }
  }

  function copyAllLinks() {
    if (!result?.invites.length) return;
    const text = result.invites
      .map((inv) => `${inv.name} <${inv.email}>\n${inv.link}`)
      .join('\n\n');
    navigator.clipboard.writeText(text).then(() => toast.success('All invite links copied'));
  }

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => r.error).length;

  return (
    <div className="border-b bg-blue-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Import Players from CSV</h3>
        <Button size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <p className="text-xs text-gray-600">
        CSV must have a header row with columns: <code>name</code>, <code>email</code> (required),
        plus optional <code>company</code>, <code>title</code>, <code>team</code>,{' '}
        <code>starting_hole</code>
      </p>

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="text-sm file:mr-3 file:rounded file:border-0 file:bg-[#1a472a] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-[#143820]"
        />
      </div>

      {rows.length > 0 && !result && (
        <>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-green-700">{validCount} valid</span>
            {errorCount > 0 && <span className="text-red-600">{errorCount} errors</span>}
            <span className="text-gray-500">{rows.length} total rows</span>
          </div>

          <div className="max-h-60 overflow-auto rounded border bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500">
                  <th className="px-2 py-1 text-left">#</th>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Email</th>
                  <th className="px-2 py-1 text-left">Company</th>
                  <th className="px-2 py-1 text-left">Team</th>
                  <th className="px-2 py-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.error ? 'bg-red-50' : ''}>
                    <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1">{r.email}</td>
                    <td className="px-2 py-1 text-gray-500">{r.company}</td>
                    <td className="px-2 py-1 text-gray-500">{r.team}</td>
                    <td className="px-2 py-1">
                      {r.error ? (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-3 w-3" /> {r.error}
                        </span>
                      ) : (
                        <span className="text-green-600">
                          <CheckCircle2 className="inline h-3 w-3" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            size="sm"
            className="bg-[#1a472a] hover:bg-[#143820]"
            onClick={doImport}
            disabled={importing || validCount === 0}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? 'Importing…' : `Import ${validCount} Players`}
          </Button>
        </>
      )}

      {result && (
        <div className="space-y-3 rounded border bg-white p-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-green-700">{result.imported} imported</span>
            {result.teamsCreated.length > 0 && (
              <span className="text-blue-600">{result.teamsCreated.length} teams created</span>
            )}
            {result.errors.length > 0 && (
              <span className="text-red-600">{result.errors.length} errors</span>
            )}
          </div>

          {result.errors.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-red-600 font-medium">View errors</summary>
              <ul className="mt-1 space-y-0.5 pl-4 list-disc text-red-700">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row} ({e.email || 'no email'}): {e.error}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {result.invites.length > 0 && (
            <Button size="sm" variant="outline" onClick={copyAllLinks}>
              <Copy className="mr-2 h-3 w-3" />
              Copy All Invite Links ({result.invites.length})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
