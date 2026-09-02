import { z } from "zod";

/**
 * Zod validation schema for the user login form.
 * @property {string} email - Must be a valid email format.
 * @property {string} password - Must be at least 6 characters long.
 */
export const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

/**
 * Zod validation schema for the user signup form.
 * Includes a refinement step to ensure the password and confirmPassword fields match.
 * @property {string} fullName - Must be at least 2 characters long.
 * @property {string} email - Must be a valid email format.
 * @property {string} password - Must be at least 6 characters long.
 * @property {string} confirmPassword - Must match the password field.
 */
export const signupSchema = z
  .object({
    fullName: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"], // Attaches the error to the confirmPassword field
  });

/**
 * Inferred TypeScript type for the login form values, derived from `loginSchema`.
 * @see loginSchema
 */
export type TypeLoginFormValues = z.infer<typeof loginSchema>;

/**
 * Inferred TypeScript type for the signup form values, derived from `signupSchema`.
 * @see signupSchema
 */
export type TypeSignupFormValues = z.infer<typeof signupSchema>;
