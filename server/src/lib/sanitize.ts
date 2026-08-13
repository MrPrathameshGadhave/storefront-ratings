/**
 * Input sanitization utilities to prevent XSS and injection attacks.
 * Provides HTML entity encoding and text sanitization functions.
 */

/**
 * HTML entity encoding map for XSS prevention
 */
const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Use this when displaying user input in HTML context.
 *
 * @param text - The text to escape
 * @returns Escaped text safe for HTML display
 *
 * @example
 * escapeHtml("<script>alert('xss')</script>") // "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"'/]/g, (char) => ENTITY_MAP[char] || char);
}

/**
 * Removes potentially dangerous HTML tags and attributes.
 * More conservative than escapeHtml - removes all HTML.
 * Use this for user-generated text content.
 *
 * @param text - The text to sanitize
 * @returns Sanitized text with HTML removed
 *
 * @example
 * sanitizeText("<p>Hello <script>alert('xss')</script>World</p>") // "Hello World"
 */
export function sanitizeText(text: string): string {
  // Remove all HTML tags and decode entities
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags and content
    .replace(/<[^>]*>/g, "") // Remove all HTML tags
    .replace(/&[a-zA-Z0-9]+;/g, (entity) => {
      // Basic entity decoding for safety
      const decoded: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#x27;": "'",
        "&#x2F;": "/",
      };
      return decoded[entity] || entity;
    })
    .trim();
}

/**
 * Validates and normalizes email addresses.
 * Performs basic validation and lowercasing.
 *
 * @param email - The email to normalize
 * @returns Normalized email (lowercase)
 *
 * @throws Error if email is invalid
 *
 * @example
 * normalizeEmail("User@Example.COM") // "user@example.com"
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  // Basic email validation regex (RFC 5322 simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error("Invalid email format");
  }
  return trimmed;
}

/**
 * Validates a password against security requirements.
 * Requirements: 8-16 chars, at least one uppercase, at least one special char.
 *
 * @param password - The password to validate
 * @returns Object with validation result and error details
 *
 * @example
 * validatePassword("Weak123") // { valid: false, errors: ["Must contain a special character"] }
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8 || password.length > 16) {
    errors.push("Password must be 8-16 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[^a-zA-Z0-9\s]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes user input for display in error messages and API responses.
 * Prevents sensitive data leakage and XSS.
 *
 * @param input - The input to sanitize
 * @param maxLength - Maximum length of output (default 100)
 * @returns Sanitized string safe for display
 *
 * @example
 * sanitizeForDisplay("<script>", 10) // "&lt;script&gt;" (truncated if needed)
 */
export function sanitizeForDisplay(input: string, maxLength = 100): string {
  let sanitized = escapeHtml(input);
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + "...";
  }
  return sanitized;
}

/**
 * Validates a name string according to requirements.
 * Requirements: 20-60 characters.
 *
 * @param name - The name to validate
 * @returns Object with validation result
 *
 * @example
 * validateName("John Doe") // { valid: false, message: "Name must be 20-60 characters" }
 */
export function validateName(name: string): {
  valid: boolean;
  message?: string;
} {
  const trimmed = name.trim();
  if (trimmed.length < 20 || trimmed.length > 60) {
    return {
      valid: false,
      message: "Name must be 20-60 characters",
    };
  }
  return { valid: true };
}

/**
 * Validates an address string according to requirements.
 * Requirements: maximum 400 characters.
 *
 * @param address - The address to validate
 * @returns Object with validation result
 *
 * @example
 * validateAddress("123 Main St") // { valid: true }
 */
export function validateAddress(address: string): {
  valid: boolean;
  message?: string;
} {
  const trimmed = address.trim();
  if (!trimmed) {
    return {
      valid: false,
      message: "Address is required",
    };
  }
  if (trimmed.length > 400) {
    return {
      valid: false,
      message: "Address must not exceed 400 characters",
    };
  }
  return { valid: true };
}
