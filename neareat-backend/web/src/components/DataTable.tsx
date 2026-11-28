import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** ≤720px kart görünümünde hücre başlığı (`data-label`). İlk sütun ve eylemlerde gerekmez. */
  label?: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Satır başına eylem hücresi (`.cell-actions`; mobilde tam genişlik, 44px). */
  actions?: (row: T) => ReactNode;
  actionsHeader?: string;
}

/**
 * Duyarlı tablo (BILESENLER §2): `table.table.table-stack`, her `td` için `data-label`,
 * ilk hücre `.cell-primary`. 720px altında CSS satırları karta çevirir.
 */
export function DataTable<T>({ caption, columns, rows, rowKey, actions, actionsHeader = 'İşlem' }: DataTableProps<T>) {
  return (
    <table className="table table-stack">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => <th key={c.key} scope="col">{c.header}</th>)}
          {actions && <th scope="col" className="cell-actions">{actionsHeader}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((c, i) => (
              <td
                key={c.key}
                className={[i === 0 ? 'cell-primary' : '', c.className ?? ''].filter(Boolean).join(' ') || undefined}
                data-label={i === 0 ? undefined : (c.label ?? (typeof c.header === 'string' ? c.header : undefined))}
              >
                {c.render(row)}
              </td>
            ))}
            {actions && <td className="cell-actions">{actions(row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
