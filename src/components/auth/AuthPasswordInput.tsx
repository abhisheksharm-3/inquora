"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { TypePasswordInputProps } from "@/types/auth";
import { Button } from "../ui/button";
import { cn } from "@/ui/lib/cn";

/**
 * Renders a password input field with a toggle to show or hide the password text.
 *
 * This component is designed to integrate with `react-hook-form` by accepting
 * the `field` prop. It enhances user experience for password entry fields.
 *
 * @param {TypePasswordInputProps} props - The component's properties.
 * @param {object} props.field - The field object from `react-hook-form`'s `render` prop.
 * @param {string} [props.placeholder="••••••••"] - Optional placeholder text for the input.
 * @param {string} [props.className=""] - Optional CSS classes to apply to the input element.
 * @param {boolean} [props.disabled=false] - Whether the input is disabled.
 * @returns {React.ReactElement} The rendered password input component.
 */
export const AuthPasswordInput = ({
  field,
  placeholder = "••••••••",
  className = "",
  disabled = false,
}: TypePasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const isPasswordVisible = showPassword;
  const VisibilityIcon = isPasswordVisible ? EyeOff : Eye;
  const buttonAriaLabel = isPasswordVisible ? "Hide password" : "Show password";

  return (
    <div className="relative">
      <Input
        type={isPasswordVisible ? "text" : "password"}
        placeholder={placeholder}
        className={cn("pr-10", className)}
        disabled={disabled}
        {...field}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={togglePasswordVisibility}
        disabled={disabled}
        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 p-0"
        tabIndex={-1}
        aria-label={buttonAriaLabel}
      >
        <VisibilityIcon
          size={16}
          className={cn(
            "transition-colors",
            disabled ? "text-gray-300" : "text-gray-400 hover:text-gray-600",
          )}
        />
      </Button>
    </div>
  );
};
