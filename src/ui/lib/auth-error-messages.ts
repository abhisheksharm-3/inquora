import { TypeAuthErrorInfo, EnumAuthErrorType } from "@/ui/lib/auth.types";

/**
 * A map that converts known error message substrings into structured, user-friendly error information.
 *
 * The keys are lowercase strings that are checked for inclusion in raw error messages.
 */
export const ErrorMessages = new Map<string, TypeAuthErrorInfo>([
  // Supabase Auth errors
  [
    "invalid login credentials",
    {
      type: EnumAuthErrorType.AUTHENTICATION_ERROR,
      userMessage: "Incorrect email or password. Please try again.",
      retryable: true,
    },
  ],
  [
    "email not confirmed",
    {
      type: EnumAuthErrorType.AUTHENTICATION_ERROR,
      userMessage: "Please confirm your email before signing in.",
      retryable: false,
    },
  ],
  [
    "user already registered",
    {
      type: EnumAuthErrorType.VALIDATION_ERROR,
      userMessage: "An account with this email already exists. Please sign in.",
      retryable: false,
    },
  ],
  [
    "password should be at least 6 characters",
    {
      type: EnumAuthErrorType.VALIDATION_ERROR,
      userMessage: "Your password must be at least 6 characters long.",
      retryable: false,
    },
  ],
  [
    "unable to validate email address",
    {
      type: EnumAuthErrorType.VALIDATION_ERROR,
      userMessage: "Please enter a valid email address.",
      retryable: false,
    },
  ],
  [
    "email rate limit exceeded",
    {
      type: EnumAuthErrorType.RATE_LIMIT_ERROR,
      userMessage: "Too many attempts. Please wait a few minutes before trying again.",
      retryable: true,
      retryAfter: 300, // 5 minutes
    },
  ],

  // Network and connectivity errors
  [
    "fetch",
    {
      type: EnumAuthErrorType.NETWORK_ERROR,
      userMessage: "Connection problem. Please check your internet and try again.",
      retryable: true,
    },
  ],

  // Database errors
  [
    "duplicate key value",
    {
      type: EnumAuthErrorType.DATABASE_ERROR,
      userMessage: "This account already exists. Please try signing in.",
      retryable: false,
    },
  ],
]);

/** A shared object for generic server errors to avoid repetition. */
const ServerErrorInfo: TypeAuthErrorInfo = {
  type: EnumAuthErrorType.SERVER_ERROR,
  userMessage: "Our servers are experiencing issues. Please try again in a few minutes.",
  retryable: true,
};

/**
 * A map that converts HTTP status codes to structured error information.
 */
export const HttpStatusErrorMap = new Map<number, TypeAuthErrorInfo>([
  [
    400,
    {
      type: EnumAuthErrorType.VALIDATION_ERROR,
      userMessage: "Please check your input and try again.",
      retryable: false,
    },
  ],
  [
    401,
    {
      type: EnumAuthErrorType.AUTHENTICATION_ERROR,
      userMessage: "Authentication failed. Please check your credentials.",
      retryable: true,
    },
  ],
  [
    403,
    {
      type: EnumAuthErrorType.AUTHORIZATION_ERROR,
      userMessage: "Access denied. You do not have permission for this action.",
      retryable: false,
    },
  ],
  [
    429,
    {
      type: EnumAuthErrorType.RATE_LIMIT_ERROR,
      userMessage: "Too many requests. Please wait a moment and try again.",
      retryable: true,
      retryAfter: 60,
    },
  ],
  [500, ServerErrorInfo],
  [502, ServerErrorInfo],
  [503, ServerErrorInfo],
  [504, ServerErrorInfo],
]);
