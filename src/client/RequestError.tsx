import type { ReactNode } from "react";
import { Button } from "./Button";

export function RequestError({ error, retry, loading = false, children }: {
  error: string; retry?: () => void; loading?: boolean; children?: ReactNode;
}) {
  if (!error) return null;
  return <div className="error-banner" role="alert">
    <p>{error}</p>
    {retry && <Button variant="secondary" loading={loading} onClick={retry}>Try again</Button>}
    {children}
  </div>;
}
