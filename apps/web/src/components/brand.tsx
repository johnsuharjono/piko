export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="piko-brand">
      <img src="/piko-mark.svg" width="28" height="28" alt="" />
      {!compact && (
        <span className="piko-wordmark">
          piko<span>.</span>
        </span>
      )}
    </span>
  );
}
