import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function Disclosure({ title, children, contentClassName = "disclosure-content", ...props }: Omit<ComponentProps<"details">, "title"> & {
  title: ReactNode; contentClassName?: string;
}) {
  return <details {...props}>
    <summary><span>{title}</span><ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" /></summary>
    <div className={contentClassName}>{children}</div>
  </details>;
}
