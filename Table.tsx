import React from 'react';
import TableHeader from './TableHeader';
import TableBody from './TableBody';
import TablePagination from './TablePagination';

interface TableProps {
  columns: any[];
  data: {
    content: Record<string, any>[];
    pageNo: number;
    totalPages: number;
    totalCount: number;
    pageRowCount: number;
  };
  onPageChange: (args: Record<string, any>) => void;
  onRowClick?: (row: any) => void;
  form?: Record<string, any>;
  setForm?: React.Dispatch<any>;
  filter?: any;
  inputProps?: any;
  embedded?: boolean; // default false
  childColumns?: any[];
  getChildren?: (row: any) => any[] | undefined | null;
  rowKey?: (row: any, index: number) => string;
  aligns: 'left' | 'center' | 'right';
}

/**
 * Table.tsx
 * - table, header, body, pagination 통합
 */
const Table: React.FC<TableProps> = ({
  columns,
  data,
  onPageChange,
  onRowClick,
  form,
  setForm,
  filter,
  inputProps,
  embedded = false,
  aligns = 'center',
  childColumns,
  getChildren = (r: any) => r?.children,
  rowKey,
}) => {
  const { pageNo, totalPages, totalCount, pageRowCount } = data || {};
  const items = data?.content || [];

  const getRowKey = React.useCallback(
    (r: any, i: number) => String(rowKey ? rowKey(r, i) : r?.id ?? r?.workSequence ?? r?.robotSequence ?? i),
    [rowKey]
  );

  const totalArray = items.map((el, i) => getRowKey(el, i));
  // const totalArray = items?.map((el) => String(el?.id));
  const leafColumns = React.useMemo(
    () => columns.flatMap((c: any) => (Array.isArray(c?.children) ? c.children : [c])),
    [columns]
  );

  const nested = React.useMemo(() => {
    if (Array.isArray(childColumns) && childColumns.length > 0) {
      return { childColumns, getChildren };
    }
    return undefined;
  }, [childColumns, getChildren]);

  // If form/setForm are passed, it means this is a nested table needing isolated state.
  // We create a new inputProps function that uses the isolated form state.
  // Otherwise, we use the inputProps from the parent (top-level page).
  const finalInputProps =
    form && setForm
      ? (name: string, label: string) => ({
          id: name,
          name,
          form,
          setForm,
          label,
        })
      : inputProps;

  return (
    <div>
      <table
        className={
          embedded
            ? 'w-full text-center border border-gray-200 text-sm'
            : 'min-w-full text-center border border-gray-300'
        }
      >
        <colgroup>
          {columns.map((c: any, idx: number) =>
            c.children?.length > 0 ? (
              c.children.map((a: any, i: number) => <col key={a + i} className={a.width} />)
            ) : (
              <col key={c.key + idx} className={c.width} />
            )
          )}
        </colgroup>
        <TableHeader {...{ columns, onPageChange, totalArray, filter, aligns, inputProps: finalInputProps }} />
        <TableBody
          {...{
            columns,
            data: items,
            pageNo,
            pageRowCount,
            inputProps: finalInputProps,
            onRowClick,
            nested: nested,
            rowKey: getRowKey,
            aligns,
          }}
        />
      </table>
      {!embedded && (
        <TablePagination
          {...{
            pageNo,
            totalPages,
            totalCount,
            pageRowCount,
            onPageChange,
          }}
        />
      )}
    </div>
  );
};

export default Table;
