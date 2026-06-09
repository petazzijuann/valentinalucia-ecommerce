import { teamByCode, flagUrl } from "@/data/torneo";

/** Una bandera ISO2 válida tiene 2 letras, o el prefijo "gb-" (gb-eng/gb-sct/gb-wls). */
function hasFlag(code: string): boolean {
  return /^[a-z]{2}$/.test(code) || /^gb-[a-z]{3}$/.test(code);
}

export default function TeamFlag({
  code,
  size = 40,
  showName = true,
  className = "",
}: {
  code: string;
  size?: number;
  showName?: boolean;
  className?: string;
}) {
  const team = teamByCode(code);
  const name = team?.name ?? code;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {hasFlag(code) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flagUrl(code, size)}
          alt={name}
          width={size / 2}
          className="h-auto shrink-0 rounded-[2px] ring-1 ring-black/10"
        />
      ) : (
        <span
          className="shrink-0 grid place-items-center bg-green-mid text-cream-dark text-[9px] rounded-[2px] ring-1 ring-black/10"
          style={{ width: size / 2, height: (size / 2) * 0.66 }}
          aria-hidden
        >
          ?
        </span>
      )}
      {showName && <span className="truncate">{name}</span>}
    </span>
  );
}
