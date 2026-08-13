import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFieldErrors, apiMessage, apiRequest } from "../lib/api";
import {
  validatePassword,
  validatePasswordConfirmation,
  type ValidationErrors,
} from "../lib/validation";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { destinationForRole } from "../types";
import { InlineAlert, PageHeader } from "../components/ui";

interface PasswordFields {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const emptyFields: PasswordFields = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function PasswordPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [fields, setFields] = useState<PasswordFields>(emptyFields);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof PasswordFields) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ValidationErrors = {};
    if (!fields.currentPassword) {
      nextErrors.currentPassword = "Enter your current password.";
    }
    const passwordError = validatePassword(fields.newPassword);
    const confirmationError = validatePasswordConfirmation(
      fields.confirmPassword,
      fields.newPassword,
    );
    if (passwordError) nextErrors.newPassword = passwordError;
    if (confirmationError) nextErrors.confirmPassword = confirmationError;
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest<unknown>("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: fields.currentPassword,
          newPassword: fields.newPassword,
        }),
      });
      setFields(emptyFields);
      showToast("Your password has been updated.", "success");
    } catch (error) {
      setErrors((current) => ({ ...current, ...apiFieldErrors(error) }));
      setFormError(apiMessage(error, "We could not update your password."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-container page-container--narrow">
      <PageHeader
        title="Update password"
        description="Use a strong, unique password to keep your account secure."
      />
      <form className="surface-card form-stack" onSubmit={submitPassword} noValidate>
        {formError ? <InlineAlert>{formError}</InlineAlert> : null}
        <div className="field">
          <label htmlFor="current-password">
            Current password <span aria-hidden="true">*</span>
          </label>
          <input
            id="current-password"
            type="password"
            value={fields.currentPassword}
            onChange={updateField("currentPassword")}
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            aria-describedby={errors.currentPassword ? "current-password-error" : undefined}
            required
          />
          {errors.currentPassword ? (
            <p className="field__error" id="current-password-error">
              {errors.currentPassword}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="new-password">
            New password <span aria-hidden="true">*</span>
          </label>
          <input
            id="new-password"
            type="password"
            value={fields.newPassword}
            onChange={updateField("newPassword")}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.newPassword)}
            aria-describedby="new-password-hint new-password-error"
            required
          />
          <p className="field__hint" id="new-password-hint">
            8-16 characters, with an uppercase letter and a special character.
          </p>
          {errors.newPassword ? (
            <p className="field__error" id="new-password-error">
              {errors.newPassword}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="confirm-new-password">
            Confirm new password <span aria-hidden="true">*</span>
          </label>
          <input
            id="confirm-new-password"
            type="password"
            value={fields.confirmPassword}
            onChange={updateField("confirmPassword")}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? "confirm-new-password-error" : undefined}
            required
          />
          {errors.confirmPassword ? (
            <p className="field__error" id="confirm-new-password-error">
              {errors.confirmPassword}
            </p>
          ) : null}
        </div>
        <div className="form-actions">
          <Link
            className="button button--secondary"
            to={user ? destinationForRole(user.role) : "/"}
          >
            Cancel
          </Link>
          <button type="submit" className="button button--primary" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </section>
  );
}
