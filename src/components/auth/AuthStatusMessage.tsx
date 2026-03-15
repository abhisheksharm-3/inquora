import { TypeStatusMessageProps } from "@/types/auth";

/**
 * Displays a styled message for authentication status feedback, like errors or success notes.
 * Renders nothing if no message is provided.
 *
 * @param {TypeStatusMessageProps} props The properties for the component.
 * @param {string} [props.message] The feedback message to display (e.g., "Invalid credentials.").
 * @param {'error' | 'success'} props.type The type of message, which determines the component's color scheme.
 * @returns {JSX.Element | null} A styled `div` with the message, or `null` if no message is provided.
 */
export const AuthStatusMessage = ({
  message,
  type,
}: TypeStatusMessageProps) => {
  if (!message) {
    return null;
  }

  const bgColor = type === "error" ? "bg-destructive/15" : "bg-green-500/15";
  const textColor = type === "error" ? "text-destructive" : "text-green-500";

  return (
    <div className={`rounded-md ${bgColor} p-3 text-sm ${textColor}`}>
      {message}
    </div>
  );
};
