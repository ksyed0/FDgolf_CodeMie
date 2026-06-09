import type { Sponsor } from '@/lib/types';

interface SponsorBannerProps {
  sponsors: Sponsor[];
}

export function SponsorBanner({ sponsors }: SponsorBannerProps) {
  const active = sponsors
    .filter((s) => s.is_active)
    .sort((a, b) => a.display_order - b.display_order);

  if (active.length === 0) return null;

  return (
    <div className="flex w-full items-center justify-center gap-4 overflow-x-auto bg-gray-100 px-4 py-2">
      {active.map((sponsor) => (
        <div key={sponsor.id} className="flex shrink-0 items-center">
          {sponsor.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sponsor.logo_url}
              alt={sponsor.name}
              className="max-h-8 w-auto object-contain"
            />
          ) : (
            <span className="text-xs font-medium text-gray-600">{sponsor.name}</span>
          )}
        </div>
      ))}
    </div>
  );
}
