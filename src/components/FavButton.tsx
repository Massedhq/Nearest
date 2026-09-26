import { toggleFavorite } from "@/app/fav-actions";

/** Heart that saves a professional to Favorites. Filled when saved. */
export function FavButton({ proId, on, size = 36, count }: { proId: string; on: boolean; size?: number; count?: number }) {
  return (
    <form action={toggleFavorite} className="row" style={{ gap: 6 }}>
      <input type="hidden" name="proId" value={proId} />
      <button className="iconbtn" type="submit" aria-pressed={on} aria-label={on ? "Remove from favorites" : "Save to favorites"} style={{ width: size, height: size, ...(on ? { background: "#ECE8E1", color: "#0A0A0A" } : {}) }}>
        <svg className="i s" width="16" height="16" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />
        </svg>
      </button>
      {count !== undefined && <span className="small b" aria-label={`Saved by ${count} ${count === 1 ? "student" : "students"}`}>{count.toLocaleString()}</span>}
    </form>
  );
}
