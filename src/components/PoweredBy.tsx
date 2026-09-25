import Image from "next/image";

/** Shown at the bottom of every screen. */
export function PoweredBy() {
  return (
    <footer className="powered">
      <a href="https://www.massed.io/" target="_blank" rel="noopener noreferrer" aria-label="Powered by Massed (opens massed.io in a new tab)">
        <span>Powered by</span>
        <Image src="/brand/massed.png" alt="" width={18} height={18} />
        <span className="b">Massed</span>
      </a>
    </footer>
  );
}
