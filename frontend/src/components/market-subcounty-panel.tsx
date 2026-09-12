import { useEffect, useMemo, useState } from "react";
import { countiesMatch } from "@/lib/geo";

export interface SubcountyRecord {
  county: string;
  name: string;
  lat: number;
  lng: number;
  source: string;
}

interface SubcountiesFile {
  version: string;
  note: string;
  subcounties: SubcountyRecord[];
}

interface Props {
  county: string;
  selectedSubcounty: string | null;
  nearestMarketLabel: string | null;
  onSelectSubcounty: (sub: SubcountyRecord) => void;
  onClose: () => void;
  className?: string;
}

export function MarketSubcountyPanel({
  county,
  selectedSubcounty,
  nearestMarketLabel,
  onSelectSubcounty,
  onClose,
  className = "",
}: Props) {
  const [items, setItems] = useState<SubcountyRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetch("/geo/kenya-subcounties.json")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load subcounty data");
        return r.json() as Promise<SubcountiesFile>;
      })
      .then((file) => {
        if (cancelled) return;
        const filtered = file.subcounties.filter((s) =>
          countiesMatch(s.county, county),
        );
        setItems(filtered);
        requestAnimationFrame(() => setVisible(true));
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Load failed");
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
      setVisible(false);
    };
  }, [county]);

  const staggerClass = useMemo(
    () => (index: number) => ({
      transitionDelay: `${index * 40}ms`,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(8px)",
    }),
    [visible],
  );

  return (
    <aside
      className={`market-panel flex flex-col bg-paper border border-hairline ${className}`}
      aria-label={`Subcounties in ${county}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-teal">Subcounties</p>
          <h2 className="font-serif text-[20px] text-ink leading-tight mt-0.5">{county}</h2>
          <p className="text-[11px] text-steel mt-1 leading-snug">
            Pick your area. We map you to the closest of Kenya&apos;s seven tracked
            wholesale markets — not subcounty-level quotes.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-[11px] text-steel hover:text-ink border border-hairline px-2 py-1"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {nearestMarketLabel && selectedSubcounty && (
        <div className="mx-4 mt-3 border border-hairline bg-canvas px-3 py-2 text-[12px] text-ink">
          <span className="text-steel">Nearest market: </span>
          <span className="font-medium">{nearestMarketLabel}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loadError && (
          <p className="px-2 py-3 text-[12px] text-rose">{loadError}</p>
        )}
        {!loadError && items.length === 0 && (
          <p className="px-2 py-3 text-[12px] text-steel">No subcounties listed.</p>
        )}
        <ul className="space-y-1">
          {items.map((sub, index) => {
            const active = selectedSubcounty === sub.name;
            return (
              <li key={`${sub.county}-${sub.name}`}>
                <button
                  type="button"
                  onClick={() => onSelectSubcounty(sub)}
                  className={`market-subcounty-item w-full text-left px-3 py-2.5 border text-[13px] transition ${
                    active
                      ? "border-ink bg-canvas text-ink"
                      : "border-transparent hover:border-hairline hover:bg-canvas/70 text-ink"
                  }`}
                  style={staggerClass(index)}
                >
                  {sub.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
