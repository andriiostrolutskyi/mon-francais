import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  iconOnly?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
};

export function Button({ variant = "primary", iconOnly = false, loading = false, icon: Icon, children,
  disabled, type = "button", className = "", title, ...props }: ButtonProps) {
  const classes = ["button", `button--${variant}`, iconOnly && "button--icon", loading && "is-loading", className].filter(Boolean).join(" ");
  return <button {...props} type={type} title={title ?? (iconOnly ? props["aria-label"] : undefined)} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>
    <span className="button-content">{Icon && <Icon size={18} strokeWidth={1.75} aria-hidden="true" />}{children}</span>
    {loading && <svg className="button-spinner" viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="42 150" />
    </svg>}
  </button>;
}

export function CloseButton({ "aria-label": label = "Close", ...props }: Omit<ComponentProps<"button">, "children">) {
  return <Button {...props} variant="ghost" iconOnly icon={X} aria-label={label} />;
}
