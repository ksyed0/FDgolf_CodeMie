export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-[#1a472a]">FDgolf</h1>
        <p className="mt-1 text-xs text-gray-500">created by AI/Run™</p>
      </div>
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}
