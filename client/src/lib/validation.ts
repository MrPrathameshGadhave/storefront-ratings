export interface ValidationErrors {
  [field: string]: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,16}$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) {
    return "Email is required.";
  }
  if (!emailPattern.test(normalizeEmail(value))) {
    return "Enter a valid email address.";
  }
  return undefined;
}

export function validateName(value: string): string | undefined {
  const length = value.trim().length;
  if (!length) {
    return "Name is required.";
  }
  if (length < 20 || length > 60) {
    return "Name must be between 20 and 60 characters.";
  }
  return undefined;
}

export function validateAddress(value: string): string | undefined {
  if (!value.trim()) {
    return "Address is required.";
  }
  if (value.trim().length > 400) {
    return "Address cannot exceed 400 characters.";
  }
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) {
    return "Password is required.";
  }
  if (!passwordPattern.test(value)) {
    return "Use 8-16 characters with an uppercase letter and a special character.";
  }
  return undefined;
}

export function validatePasswordConfirmation(value: string, password: string): string | undefined {
  if (!value) {
    return "Please confirm your password.";
  }
  if (value !== password) {
    return "Passwords do not match.";
  }
  return undefined;
}

export function collectErrors(
  values: Record<string, string>,
  validators: Record<string, (value: string) => string | undefined>,
): ValidationErrors {
  return Object.entries(validators).reduce<ValidationErrors>((errors, [field, validator]) => {
    const error = validator(values[field] ?? "");
    if (error) {
      errors[field] = error;
    }
    return errors;
  }, {});
}
