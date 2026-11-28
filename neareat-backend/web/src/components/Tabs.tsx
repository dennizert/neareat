import { useRef, type KeyboardEvent } from 'react';

export interface TabItem<K extends string> { key: K; label: string; count?: number | null }

/** Sekmeli filtre (BILESENLER §2 StatusTabs): ok tuşlarıyla gezilir, seçili sekme tabindex=0. */
export function Tabs<K extends string>({ items, value, onChange, label }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % items.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = items.length - 1;
    refs.current[n]?.focus();
    onChange(items[n].key);
  }
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((t, i) => {
        const selected = t.key === value;
        return (
          <button
            key={t.key}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            className="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
            {t.count != null && <span className="count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
