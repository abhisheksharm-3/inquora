"use client";

import { useTheme } from "next-themes";
import { useId } from "react";

const CHOICES = [
  { value: "light", label: "Light" },
  { value: "system", label: "Auto" },
  { value: "dark", label: "Dark" },
] as const;

/**
 * Three states, stated. A two-state toggle cannot express "follow the system",
 * which DESIGN.md calls a first-class path, and a dropdown for three options is
 * a menu hiding three words.
 *
 * A radio group rather than buttons, so the arrow keys move between the options
 * the way a person expects and the current choice is announced as selected.
 */
export const ThemeChoice = () => {
  const { theme, setTheme } = useTheme();
  const name = useId();

  return (
    <fieldset className="flex items-center gap-0 border-0 p-0">
      <legend className="sr-only">Theme</legend>
      {CHOICES.map((choice) => {
        const id = `${name}-${choice.value}`;
        // `theme` is undefined until next-themes has read the stored choice, and
        // "system" is the default, so an unresolved value reads as Auto rather
        // than as nothing selected.
        const selected = (theme ?? "system") === choice.value;

        return (
          <span key={choice.value}>
            <input
              type="radio"
              id={id}
              name={name}
              value={choice.value}
              checked={selected}
              onChange={() => setTheme(choice.value)}
              className="peer sr-only"
            />
            <label
              htmlFor={id}
              className={`inline-flex min-h-11 cursor-pointer items-center px-1.5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-mark peer-focus-visible:outline-offset-2 ${
                selected ? "text-ink" : "hover:text-ink"
              }`}
            >
              {choice.label}
            </label>
          </span>
        );
      })}
    </fieldset>
  );
};
