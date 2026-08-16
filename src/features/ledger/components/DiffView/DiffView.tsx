export interface DiffColumnClassNames {
  column: string;
  label: string;
  // Only some callers wrap their rows in an extra div (see AuditEntryCard);
  // when omitted the rows render directly inside the column.
  rows?: string;
  row: string;
  field: string;
  value: string;
}

export interface DiffViewClassNames {
  container: string;
  before: DiffColumnClassNames;
  after: DiffColumnClassNames;
}

interface DiffColumnProps {
  label: string;
  keys: string[];
  values: Record<string, unknown>;
  classNames: DiffColumnClassNames;
}

const DiffColumn = ({ label, keys, values, classNames }: DiffColumnProps) => {
  const rows = keys.map((key) => (
    <div key={key} className={classNames.row}>
      <span className={classNames.field}>{key}</span>
      <span className={classNames.value}>{String(values[key] ?? '—')}</span>
    </div>
  ));

  return (
    <div className={classNames.column}>
      <span className={classNames.label}>{label}</span>
      {classNames.rows ? <div className={classNames.rows}>{rows}</div> : rows}
    </div>
  );
};

// Two-column Before/After rendering of a set of changed field keys, shared
// by TransactionRow's pending-change detail and AuditEntryCard's edit diff.
// Each caller supplies its own (already visually distinct) CSS-module class
// names, so this only dedupes the structure, not the styling.
export const DiffView = ({
  changedKeys,
  before,
  after,
  classNames,
}: {
  changedKeys: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  classNames: DiffViewClassNames;
}) => (
  <div className={classNames.container}>
    <DiffColumn
      label="Before"
      keys={changedKeys}
      values={before}
      classNames={classNames.before}
    />
    <DiffColumn
      label="After"
      keys={changedKeys}
      values={after}
      classNames={classNames.after}
    />
  </div>
);
