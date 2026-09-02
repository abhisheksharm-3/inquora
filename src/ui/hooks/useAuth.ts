"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  TypeAuthAction,
  TypeAuthError,
  TypeAuthFormData,
  TypeLoginFormData,
  TypeSignupFormData,
} from "@/ui/lib/auth.types";
import { signIn, signUp } from "@/app/(auth)/actions";
import { supabaseBrowserClient } from "@/ui/supabase/browser";
import { EnumAuthErrorType } from "@/ui/lib/auth.types";
import { categorizeAuthError, handleAuthErrors } from "@/ui/lib/auth-errors";

/**
 * A custom hook to manage user authentication processes like login and signup.
 * It uses React Query's `useMutation` to handle asynchronous operations,
 * state management (loading, error, success), and server-side actions.
 */
export const useAuth = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = supabaseBrowserClient();

  const invalidateAuthQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["user"] });
    queryClient.invalidateQueries({ queryKey: ["auth"] });
  };

  const handleSuccessNavigation = (action: TypeAuthAction) => {
    if (action === "login") {
      router.push("/choose");
    } else {
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  const logAuthError = (action: TypeAuthAction, error: TypeAuthError) => {
    if (process.env.NODE_ENV !== "production") {
      console.error(`${action.charAt(0).toUpperCase() + action.slice(1)} error:`, {
        type: error.type,
        message: error.message,
        userMessage: error.userMessage,
        context: error.context,
        retryable: error.retryable,
      });
    }
  };

  const shouldRetry = (
    failureCount: number,
    error: TypeAuthError,
    action: TypeAuthAction,
  ): boolean => {
    const maxRetries = action === "login" ? 3 : 2;

    if (!error.retryable || failureCount >= maxRetries) {
      return false;
    }

    const nonRetryableTypes = [EnumAuthErrorType.RATE_LIMIT_ERROR];
    if (action === "signup") {
      nonRetryableTypes.push(
        EnumAuthErrorType.VALIDATION_ERROR,
        EnumAuthErrorType.USER_CREATION_ERROR,
      );
    }

    return !nonRetryableTypes.includes(error.type);
  };

  const calculateRetryDelay = (attemptIndex: number, error?: TypeAuthError): number => {
    const baseDelay = 1000;
    const delay = baseDelay * Math.pow(2, attemptIndex);

    if (error?.type === EnumAuthErrorType.NETWORK_ERROR) {
      return delay + Math.random() * 1000;
    }

    return delay;
  };

  const createMutationConfig = (action: TypeAuthAction) => ({
    onSuccess: () => {
      invalidateAuthQueries();
      handleSuccessNavigation(action);
    },
    onError: (error: TypeAuthError) => logAuthError(action, error),
    retry: (failureCount: number, error: TypeAuthError) => shouldRetry(failureCount, error, action),
    retryDelay: calculateRetryDelay,
  });

  const prepareFormData = (data: TypeAuthFormData, type: TypeAuthAction): FormData => {
    const formData = new FormData();

    if (type === "login") {
      const { email, password } = data as TypeLoginFormData;
      formData.append("email", email);
      formData.append("password", password);
    } else {
      const { fullName, email, password } = data as TypeSignupFormData;
      formData.append("full-name", fullName);
      formData.append("email", email);
      formData.append("password", password);
    }

    return formData;
  };

  /**
   * Creates a user profile in the public 'users' table after a successful signup.
   * This is necessary because Supabase's `auth.users` table is private.
   */
  const createUserProfile = async (signupData: TypeSignupFormData) => {
    try {
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser();

      if (sessionError) {
        throw categorizeAuthError(sessionError, {
          action: "getUser",
          step: "createUserProfile",
        });
      }

      const userId = user?.id;
      if (!userId) {
        throw categorizeAuthError(new Error("No authenticated user found after signup"), {
          action: "validateSession",
          step: "createUserProfile",
          userExists: !!user,
        });
      }

      // The profile row is created by the on_auth_user_created trigger, which
      // reads the display name out of the auth metadata. Writing it here as well
      // is how the old schema ended up with identity in two places and no
      // relationship between them.
      return { id: userId, email: signupData.email, name: signupData.fullName };
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw error as TypeAuthError;
      }

      const categorizedError = categorizeAuthError(error, {
        action: "createUserProfile",
        step: "general",
      });
      categorizedError.type = EnumAuthErrorType.USER_CREATION_ERROR;
      categorizedError.userMessage =
        "Your account was created but we couldn't complete the setup. Please contact support.";
      throw categorizedError;
    }
  };

  const executeAuthAction = async (
    data: TypeAuthFormData,
    action: TypeAuthAction,
    serverAction: (formData: FormData) => Promise<unknown>,
  ) => {
    try {
      const formData = prepareFormData(data, action);
      const result = await serverAction(formData);

      if (result) {
        const context =
          action === "login"
            ? { email: (data as TypeLoginFormData).email }
            : {
                email: (data as TypeSignupFormData).email,
                fullName: (data as TypeSignupFormData).fullName,
              };

        throw categorizeAuthError(result, { action, ...context });
      }

      return { success: true };
    } catch (error) {
      const context =
        action === "login"
          ? { email: (data as TypeLoginFormData).email }
          : {
              email: (data as TypeSignupFormData).email,
              fullName: (data as TypeSignupFormData).fullName,
            };

      handleAuthErrors(error, action, context);
    }
  };

  const loginMutation = useMutation({
    mutationFn: (data: TypeLoginFormData) => executeAuthAction(data, "login", signIn),
    ...createMutationConfig("login"),
  });

  const signupMutation = useMutation({
    mutationFn: async (data: TypeSignupFormData) => {
      const result = await executeAuthAction(data, "signup", signUp);
      if (result?.success) {
        const userProfile = await createUserProfile(data);
        return { success: true, userProfile };
      }
      return result;
    },
    ...createMutationConfig("signup"),
  });

  const getErrorFromMutation = (
    mutation: typeof loginMutation | typeof signupMutation,
  ): TypeAuthError | null => {
    const error = mutation.error;
    return error && typeof error === "object" && "type" in error ? (error as TypeAuthError) : null;
  };

  const canRetryAfter = (error: TypeAuthError | null): number | null => {
    if (!error?.retryable || !error.retryAfter) {
      return null;
    }
    return error.retryAfter * 1000;
  };

  const loginError = getErrorFromMutation(loginMutation);
  const signupError = getErrorFromMutation(signupMutation);

  return {
    // General state
    isLoading: loginMutation.isPending || signupMutation.isPending,

    // Login state
    loginError,
    loginErrorMessage: loginError?.userMessage || null,
    loginSuccess: loginMutation.isSuccess,
    isLoginLoading: loginMutation.isPending,
    isLoginRetryable: loginError?.retryable || false,

    // Signup state
    signupError,
    signupErrorMessage: signupError?.userMessage || null,
    signupSuccess: signupMutation.isSuccess,
    isSignupLoading: signupMutation.isPending,
    isSignupRetryable: signupError?.retryable || false,
    successMessage: signupMutation.isSuccess
      ? "Account created successfully! You can now sign in."
      : null,

    // Actions
    handleLogin: (data: TypeLoginFormData) => loginMutation.mutate(data),
    handleSignup: (data: TypeSignupFormData) => signupMutation.mutate(data),

    // Reset functions
    resetLoginState: () => loginMutation.reset(),
    resetSignupState: () => signupMutation.reset(),

    // Enhanced error utilities
    getRetryDelay: () => canRetryAfter(loginError) || canRetryAfter(signupError),
    getErrorContext: () => loginError?.context || signupError?.context || null,
    getCurrentErrorType: (): EnumAuthErrorType | null =>
      loginError?.type || signupError?.type || null,
  };
};
