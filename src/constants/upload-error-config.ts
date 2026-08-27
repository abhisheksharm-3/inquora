import { TypeDetailUploadErrorField, TypeUploadError } from "@/types/upload";

/**
 * Configuration for providing user-friendly help messages and styles for different error types.
 *
 * This object maps specific `TypeUploadError['type']` values to an icon,
 * a helpful message, and Tailwind CSS classes for styling the help box.
 */
export const UploadErrorHelpConfig = {
  auth: {
    icon: "🔒",
    message: "Your session may have expired. Please refresh the page and log in again.",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
  },
  network: {
    icon: "🌐",
    message:
      "Check your internet connection and try again. Large files may require a stable connection.",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-700",
  },
  validation: {
    icon: "📋",
    message: "Please check the file requirements and ensure your file meets all criteria.",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
  },
} as const;

/**
 * An array of configuration objects used to render detailed fields in an error display.
 *
 * Each object defines a piece of technical information to be shown to the user,
 * such as the error type or original error message. It includes a `condition`
 * function to determine if the field should be displayed.
 */
export const UploadErrorDetailFields: TypeDetailUploadErrorField[] = [
  {
    key: "type",
    label: "Error Type",
    getValue: (error: TypeUploadError) => error.type,
    className: "font-mono",
  },
  {
    key: "retryCount",
    label: "Retry Attempts",
    getValue: (error: TypeUploadError, retryCount?: number) => retryCount,
    condition: (error: TypeUploadError, retryCount?: number) => (retryCount ?? 0) > 0,
  },
  {
    key: "originalError",
    label: "Technical Details",
    getValue: (error: TypeUploadError) => error.originalError,
    condition: (error: TypeUploadError) => !!error.originalError,
    isCodeBlock: true,
  },
];
