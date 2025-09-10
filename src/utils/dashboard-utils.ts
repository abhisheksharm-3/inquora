import { TypeUser } from "@/types/TypeSupabase";

/**
 * Generates user initials from a user object's name.
 * - Returns 'U' (for "User") if the name is missing or empty.
 * - Returns the first letter for a single-part name (e.g., "Cher" -> "C").
 * - Returns the first letter of the first and last parts for a multi-part name (e.g., "John Doe" -> "JD").
 *
 * @param {TypeUser | null | undefined} user - The user object, which may be null or undefined.
 * @returns {string} The calculated initials, capitalized.
 */
export const getUserInitials = (user: TypeUser | null | undefined): string => {
  // Trim the name and handle cases where it's null, undefined, or just whitespace.
  const name = user?.name?.trim();
  if (!name) {
    return "U";
  }

  // Split by any amount of whitespace and filter out empty strings that can result from multiple spaces.
  const nameParts = name.split(/\s+/);

  // Handle single-part names like "Admin".
  if (nameParts.length === 1) {
    return nameParts[0].charAt(0).toUpperCase();
  }

  // Handle multi-part names like "Jane Doe" or "John Fitzgerald Kennedy".
  const firstNameInitial = nameParts[0].charAt(0);
  const lastNameInitial = nameParts[nameParts.length - 1].charAt(0);

  return (firstNameInitial + lastNameInitial).toUpperCase();
};
