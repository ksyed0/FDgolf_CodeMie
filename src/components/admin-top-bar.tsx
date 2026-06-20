interface AdminTopBarProps {
  eyebrow: string; // e.g. "TOURNAMENT MANAGEMENT"
  title: string; // e.g. "Venues"  — rendered Barlow Condensed 800 28px
  children?: React.ReactNode; // right-side action buttons
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
