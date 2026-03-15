import {
  RiFilePdf2Fill,
  RiFileWord2Fill,
  RiImage2Fill,
  RiFileExcel2Fill,
  RiFilePpt2Fill,
  RiYoutubeFill,
  RiGithubFill,
  RiGlobalLine,
} from "@remixicon/react";
import { TypeFileTypeConfig } from "@/types/upload";

/**
 * An array of configuration objects for each supported file type.
 *
 * Each object defines the properties for an uploadable content type, including its
 * name, icon component, accepted MIME types/extensions, and size limits.
 *
 * Using Remix Icons React components for consistent iconography and brand recognition.
 */
export const FileTypes: TypeFileTypeConfig[] = [
  {
    type: "pdf",
    name: "PDF",
    icon: RiFilePdf2Fill,
    iconColor: "#DC2626", // Red for PDF
    accept: ".pdf,application/pdf",
    maxSize: 10 * 1024 * 1024, // 10MB
    statusMessage:
      "Chats created before January 14, 2026 are view-only and won't support new messages.",
    statusType: "info",
  },
  {
    type: "doc",
    name: "Document",
    icon: RiFileWord2Fill,
    iconColor: "#2563EB", // Blue for documents
    accept:
      ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    maxSize: 10 * 1024 * 1024, // 10MB
    statusMessage:
      "Chats created before January 14, 2026 are view-only and won't support new messages.",
    statusType: "info",
  },
  {
    type: "image",
    name: "Image",
    icon: RiImage2Fill,
    iconColor: "#16A34A", // Green for images
    accept: ".jpg,.jpeg,.png,image/jpeg,image/png",
    maxSize: 5 * 1024 * 1024, // 5MB
    statusMessage:
      "Chats created before January 14, 2026 are view-only and won't support new messages.",
    statusType: "info",
  },
  {
    type: "sheet",
    name: "Spreadsheet",
    icon: RiFileExcel2Fill,
    iconColor: "#059669", // Emerald for spreadsheets
    accept:
      ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    maxSize: 10 * 1024 * 1024, // 10MB
    statusMessage:
      "Chats created before January 14, 2026 are view-only and won't support new messages.",
    statusType: "info",
  },
  {
    type: "slides",
    name: "Presentation",
    icon: RiFilePpt2Fill,
    iconColor: "#EA580C", // Orange for presentations
    accept:
      ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
    maxSize: 10 * 1024 * 1024, // 10MB
    statusMessage:
      "Chats created before January 14, 2026 are view-only and won't support new messages.",
    statusType: "info",
  },
  {
    type: "video",
    name: "YouTube Video",
    icon: RiYoutubeFill,
    iconColor: "#DC2626", // YouTube red
    accept: "",
    maxSize: 0,
    urlOnly: true,
    statusMessage:
      "Chats created before January 14, 2026 are view-only and won't support new messages.",
    statusType: "info",
  },
  {
    type: "github",
    name: "GitHub Repo",
    icon: RiGithubFill,
    iconColor: "#fff", // White for GitHub
    accept: "",
    maxSize: 0,
    urlOnly: true,
    statusMessage:
      "Chats created before January 14, 2026 are view-only and won't support new messages.",
    statusType: "info",
  },
  {
    type: "web",
    name: "Web Page",
    icon: RiGlobalLine,
    iconColor: "#22c55e", // Green for web
    accept: "",
    maxSize: 0,
    urlOnly: true,
    statusMessage:
      "Chats created before January 14, 2026 are view-only and won't support new messages.",
    statusType: "info",
  },
];

/** A Map for efficient O(1) lookup of file type configurations. */
const fileTypeConfigMap = new Map(FileTypes.map((ft) => [ft.type, ft]));

/**
 * Retrieves the configuration object for a specific file type.
 *
 * @param fileType The type of the file (e.g., 'pdf', 'doc').
 * @returns {TypeFileTypeConfig} The corresponding configuration object. Defaults to the first type if not found.
 */
export const getFileTypeConfig = (fileType: string): TypeFileTypeConfig => {
  return fileTypeConfigMap.get(fileType) || FileTypes[0];
};

/**
 * Compiles a flat list of all accepted MIME types and extensions from the configuration.
 *
 * @returns {string[]} An array of all unique accepted file specifiers.
 */
export const getAllAcceptedFileTypes = (): string[] => {
  return FileTypes.flatMap((ft) => (ft.accept ? ft.accept.split(",") : []));
};
