import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />;
}

export function ButtonLink({
  to,
  variant = "secondary",
  className = "",
  children,
}: {
  to: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`btn btn-${variant} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div data-field-id={id}>{children}</div>
      {hint && !error ? <div className="hint">{hint}</div> : null}
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

export function Dialog({
  title,
  children,
  onClose,
  labelledBy,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  useEffect(() => {
    const node = ref.current;
    const focusable = node?.querySelector<HTMLElement>("button, a, input, select, textarea");
    focusable?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose) onClose();
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>("button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="dialog-root" role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? headingId}
        ref={ref}
      >
        <h2 id={headingId} className="display" style={{ fontSize: 32, marginBottom: 12 }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty panel">
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-panel panel" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton" style={{ aspectRatio: "4 / 3" }} />
      <div style={{ padding: 16 }}>
        <div className="skeleton" style={{ height: 18, width: "60%", marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: "40%" }} />
      </div>
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice">{children}</div>;
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "free" | "warn" }) {
  return <span className={`badge ${tone === "free" ? "badge-free" : ""} ${tone === "warn" ? "badge-warn" : ""}`}>{children}</span>;
}
