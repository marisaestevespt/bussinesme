import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Column<T> {
  header: string;
  accessor: (row: T, index: number) => ReactNode;
  className?: string;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  maxHeight?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}

export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 48,
  maxHeight = 600,
  onRowClick,
  rowClassName,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // For small datasets, skip virtualization
  if (data.length <= 50) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={i} className={col.className}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow
              key={idx}
              className={`${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(row) || ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col, ci) => (
                <TableCell key={ci} className={col.className}>{col.accessor(row, idx)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={i} className={col.className}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
      </Table>
      <div
        ref={parentRef}
        style={{ maxHeight, overflow: 'auto' }}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <table className="w-full table-fixed">
                  <tbody>
                    <tr
                      className={`border-b border-border ${onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''} ${rowClassName?.(row) || ''}`}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((col, ci) => (
                        <td key={ci} className={`p-2 ${col.className || ''}`}>
                          {col.accessor(row, virtualRow.index)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
