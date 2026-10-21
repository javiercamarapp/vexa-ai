'use client';
import {useMemo, useState, type ReactNode} from 'react';
import {PfIcon} from './icons';
import {Empty} from './primitives';

export type Column<T> = {id: string; header: string; cell: (row: T) => ReactNode; sort?: (row: T) => string | number | null; align?: 'right'; wrap?: boolean; hideBelow?: number};
/** Tabla ordenable con selección opcional. Se desplaza DENTRO de su contenedor; las palabras de los encabezados no se parten. */
export function DataTable<T>({caption, rows, columns, rowKey, selectable = false, selected, onSelect, empty, pageSize = 25, initialSort}: {
  caption: string; rows: readonly T[]; columns: ReadonlyArray<Column<T>>; rowKey: (row: T) => string; selectable?: boolean; selected?: ReadonlySet<string>; onSelect?: (next: Set<string>) => void;
  empty?: ReactNode; pageSize?: number; initialSort?: {id: string; dir: 'asc' | 'desc'};
}) {
  const [sort, setSort] = useState<{id: string; dir: 'asc' | 'desc'} | null>(initialSort ?? null), [shown, setShown] = useState(pageSize);
  const sorted = useMemo(() => {
    const col = columns.find(c => c.id === sort?.id);
    if (!col?.sort || !sort) return rows;
    const get = col.sort, dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => { const x = get(a), y = get(b); if (x === y) return 0; if (x === null) return 1; if (y === null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * dir; });
  }, [rows, columns, sort]);
  const visible = sorted.slice(0, shown), keys = visible.map(rowKey), all = keys.length > 0 && keys.every(k => selected?.has(k));
  if (!rows.length) return <>{empty ?? <Empty title="Sin resultados">No hay filas con los filtros actuales.</Empty>}</>;
  const toggle = (k: string) => { const n = new Set(selected); if (n.has(k)) n.delete(k); else n.add(k); onSelect?.(n); };
  return <div className="pf-table-block">
    <div className="table-wrap pf-table-wrap" tabIndex={0} role="region" aria-label={caption + ', desplazamiento horizontal'}>
      <table className="pf-table"><caption className="sr-only">{caption}</caption>
        <thead><tr>
          {selectable && <th scope="col" className="pf-check"><input type="checkbox" aria-label="Seleccionar todas las filas visibles" checked={all} onChange={() => { const n = new Set(selected); if (all) keys.forEach(k => n.delete(k)); else keys.forEach(k => n.add(k)); onSelect?.(n); }} /></th>}
          {columns.map(c => <th key={c.id} scope="col" className={c.align === 'right' ? 'num' : undefined} aria-sort={sort?.id === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
            {c.sort ? <button type="button" className="btn btn-ghost btn-sm pf-sort" onClick={() => setSort(s => ({id: c.id, dir: s?.id === c.id && s.dir === 'asc' ? 'desc' : 'asc'}))}><span className="btn-label">{c.header}</span>{sort?.id === c.id && <PfIcon name={sort.dir === 'asc' ? 'up' : 'down'} size={12} />}</button> : c.header}
          </th>)}
        </tr></thead>
        <tbody>{visible.map(r => { const k = rowKey(r); return <tr key={k} data-selected={selected?.has(k) || undefined}>
          {selectable && <td className="pf-check"><input type="checkbox" aria-label={'Seleccionar fila'} checked={!!selected?.has(k)} onChange={() => toggle(k)} /></td>}
          {columns.map(c => <td key={c.id} className={(c.align === 'right' ? 'num ' : '') + (c.wrap ? 'pf-wrap' : '')}>{c.cell(r)}</td>)}
        </tr>; })}</tbody>
      </table>
    </div>
    {shown < sorted.length && <p className="pf-more"><button type="button" className="btn btn-sm" onClick={() => setShown(n => n + pageSize)}>Mostrar más ({sorted.length - shown} restantes)</button></p>}
  </div>;
}
export function BulkBar({count, children, onClear}: {count: number; children: ReactNode; onClear: () => void}) {
  if (!count) return null;
  return <div className="pf-bulk" role="region" aria-label="Acciones sobre la selección"><strong>{count} seleccionada{count === 1 ? '' : 's'}</strong><div className="btn-group">{children}<button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>Limpiar selección</button></div></div>;
}
export function downloadCsv(name: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s) && !/^[+\-−]?[\d.,]+( %| pp| [A-Z]{3})?$/.test(s)) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const blob = new Blob(['﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n') + '\r\n'], {type: 'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
