import { formatARS } from "@/lib/utils";

interface Props {
  label:    string;
  value:    number | string;
  format?:  "currency" | "percent" | "number";
  sub?:     string;
  negative?: boolean;
}

export default function MetricCard({ label, value, format, sub, negative }: Props) {
  let display: string;
  if (format === "currency") display = formatARS(Number(value));
  else if (format === "percent") display = `${value}%`;
  else display = String(value);

  return (
    <div className="bg-card border border-border p-6">
      <p className="label-tag text-[10px] text-muted-foreground mb-3">{label}</p>
      <p className={`font-bebas text-4xl tracking-wide leading-none ${negative ? "text-red-500" : ""}`}>
        {display}
      </p>
      {sub && (
        <p className="label-tag text-[10px] text-muted-foreground mt-2">{sub}</p>
      )}
    </div>
  );
}
