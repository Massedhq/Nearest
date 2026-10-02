/** The invitation expiration box: date + time (Central). Required on every invitation. */
export function ExpiryField({ id = "expiresAt", label = "Expires" }: { id?: string; label?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name="expiresAt" type="datetime-local" required />
      <span className="xs muted">Date and time (Central). The link stops working after this.</span>
    </div>
  );
}
