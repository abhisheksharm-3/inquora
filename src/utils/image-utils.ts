/**
 * This module contains client-side utility functions for working with images.
 * These functions are designed to run in the browser.
 */

/**
 * Creates a context string for a chat model, combining file information with a user's query.
 *
 * This function builds a descriptive sentence that informs the model about an image
 * the user is referencing.
 *
 * @param {string} fileName - The name of the image file (e.g., "cat_photo.jpg").
 * @param {string} userQuery - The user's question or statement about the image.
 * @param {string} [imageUrl] - The optional URL where the image can be accessed.
 * @returns {string} A formatted context string to be sent to the model.
 */
export const createImageContext = (
  fileName: string,
  userQuery: string,
  imageUrl?: string,
): string => {
  let context = `I'm looking at an image file named "${fileName}".`;

  if (imageUrl) {
    context += ` The image can be viewed at: ${imageUrl}.`;
  }

  return `${context} ${userQuery}`;
};

/**
 * Checks if a file is an image by inspecting its MIME type.
 *
 * @param {string} mimeType - The MIME type of the file (e.g., "image/jpeg", "image/png").
 * @returns {boolean} `true` if the MIME type starts with "image/", `false` otherwise.
 */
export const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith("image/");
};
