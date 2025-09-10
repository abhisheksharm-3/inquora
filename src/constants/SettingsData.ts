import { TypeUser } from "@/types/TypeSupabase";

/**
 * An array of configuration objects for rendering sections in a desktop settings UI.
 *
 * Each object defines a user profile field, including its display label,
 * the corresponding key in the `TypeUser` object, and whether it is editable.
 */
export const SettingsSections = [
  {
    id: "displayName",
    label: "Display name",
    key: "name" as keyof TypeUser,
    placeholder: "Your name",
    editable: true,
    fallback: "Not set",
  },
  {
    id: "email",
    label: "Email Address",
    key: "email" as keyof TypeUser,
    editable: false,
    fallback: "Not available",
  },
];

/**
 * An array of configuration objects for rendering sections in a mobile settings UI.
 *
 * Each object defines a setting, its display label, and a `getUserValue` function
 * to retrieve and format the corresponding value from the user object.
 */
export const MobileSettingsSections = [
  {
    id: "displayName",
    label: "Display name",
    getUserValue: (user: TypeUser | null) => user?.name || "Not set",
  },
  {
    id: "email",
    label: "Email Address",
    getUserValue: (user: TypeUser | null) => user?.email || "Not available",
  },
  {
    id: "plan",
    label: "Current Plan",
    getUserValue: () => "Free", // Static value for now
  },
];
