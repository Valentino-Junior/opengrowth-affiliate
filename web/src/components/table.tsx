// Table pieces in the mockups' style: muted small headers, soft row rules, scrolls sideways on phones.

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-xs first:pl-6 last:pr-6 font-semibold tracking-wider whitespace-nowrap text-muted ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`border-t border-line-soft px-4 py-3 align-middle first:pl-6 last:pr-6 ${className}`}>{children}</td>;
}

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="border-t border-line-soft px-6 py-8 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}
