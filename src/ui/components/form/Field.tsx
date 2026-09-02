import { cn } from "@/ui/lib/cn";

/**
 * A field is a line of writing, not a box: a visible mono label above a serif
 * value on a hairline rule, and the rule turns oxide while the field has focus.
 *
 * The label is always visible. Placeholder text is never the only label, and an
 * error appears beside the field it concerns rather than collected at the top.
 */
export const Field = ({
  name,
  label,
  type = "text",
  autoComplete,
  required = true,
  defaultValue,
  error,
  hint,
}: {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
  hint?: string;
}) => {
  const describedBy = [error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(" ");

  return (
    <div className="mb-6">
      <label
        htmlFor={name}
        className="mb-1.5 block font-record text-label text-faint uppercase tracking-[0.12em]"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        // 44px tall so the touch target clears the floor, and the caret is the
        // mark, which is the one place a colour is spent on an input.
        className={cn(
          "block h-9 w-full border-0 border-b bg-transparent px-0 pb-2 font-light font-reading text-[1.08rem] text-ink caret-mark",
          "focus-visible:border-mark focus-visible:outline-none",
          error ? "border-danger" : "border-rule",
        )}
      />
      {hint ? (
        <p id={`${name}-hint`} className="mt-2.5 font-record text-label text-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 font-record text-label text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};
