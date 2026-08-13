import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiFieldErrors, apiMessage, apiRequest } from "../lib/api";
import {
  normalizeEmail,
  validateAddress,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
  type ValidationErrors,
} from "../lib/validation";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { destinationForRole, getString, isRecord } from "../types";
import { InlineAlert, useDocumentTitle } from "../components/ui";

interface InputFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: "email" | "password" | "text";
  autoComplete?: string;
  maxLength?: number;
  multiline?: boolean;
}

function InputField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required = false,
  type = "text",
  autoComplete,
  maxLength,
  multiline = false,
}: InputFieldProps) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
    .filter(Boolean)
    .join(" ");
  const commonProps = {
    id,
    value,
    onChange,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy || undefined,
    required,
    autoComplete,
    maxLength,
  };

  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </label>
      {multiline ? <textarea {...commonProps} rows={4} /> : <input {...commonProps} type={type} />}
      {hint ? (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  hint,
}: Omit<InputFieldProps, "type" | "multiline">) {
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} <span aria-hidden="true">*</span>
      </label>
      <div className="password-input">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          required
        />
        <button
          type="button"
          className="password-input__toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  useDocumentTitle(title);
  return (
    <main className="auth-layout">
      <section className="auth-panel auth-panel--intro" aria-label="About StoreRate">
        <Link className="brand brand--light" to="/login" aria-label="StoreRate sign in">
          <span className="brand__mark" aria-hidden="true">
            S
          </span>
          <span>StoreRate</span>
        </Link>
        <div className="auth-panel__copy">
          <p className="eyebrow eyebrow--light">Trusted feedback, simply managed</p>
          <h1>Bring every store rating into focus.</h1>
          <p>
            A secure workspace for customers, store owners, and administrators to make feedback
            useful.
          </p>
        </div>
        <p className="auth-panel__footnote">Clear ratings. Better store decisions.</p>
      </section>
      <section className="auth-panel auth-panel--form">
        <div className="auth-card">
          <div className="auth-card__heading">
            <p className="eyebrow">Account access</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const { acceptSession, refresh } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ValidationErrors = {};
    const emailError = validateEmail(email);
    if (emailError) {
      nextErrors.email = emailError;
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiRequest<unknown>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizeEmail(email), password }),
      });
      const sessionUser = acceptSession(response) ?? (await refresh());
      if (!sessionUser) {
        setFormError("We could not start your session. Please try again.");
        return;
      }

      const returnPath = isRecord(location.state) ? getString(location.state.from) : "";
      const destination = returnPath.startsWith("/")
        ? returnPath
        : destinationForRole(sessionUser.role);
      showToast("Welcome back.", "success");
      navigate(destination, { replace: true });
    } catch (error) {
      setErrors((current) => ({ ...current, ...apiFieldErrors(error) }));
      setFormError(apiMessage(error, "We could not sign you in. Please check your details."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" description="Sign in to continue to your StoreRate workspace.">
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {formError ? <InlineAlert>{formError}</InlineAlert> : null}
        <InputField
          id="login-email"
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          autoComplete="email"
          required
        />
        <PasswordInput
          id="login-password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoComplete="current-password"
          required
        />
        <button
          className="button button--primary button--full"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-card__footer">
        New to StoreRate? <Link to="/register">Create a customer account</Link>
      </p>
    </AuthLayout>
  );
}

interface RegistrationFields {
  name: string;
  email: string;
  address: string;
  password: string;
  confirmPassword: string;
}

const initialRegistration: RegistrationFields = {
  name: "",
  email: "",
  address: "",
  password: "",
  confirmPassword: "",
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<RegistrationFields>(initialRegistration);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField =
    (field: keyof RegistrationFields) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFields((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: "" }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ValidationErrors = {};
    const nameError = validateName(fields.name);
    const emailError = validateEmail(fields.email);
    const addressError = validateAddress(fields.address);
    const passwordError = validatePassword(fields.password);
    const confirmationError = validatePasswordConfirmation(fields.confirmPassword, fields.password);
    if (nameError) nextErrors.name = nameError;
    if (emailError) nextErrors.email = emailError;
    if (addressError) nextErrors.address = addressError;
    if (passwordError) nextErrors.password = passwordError;
    if (confirmationError) nextErrors.confirmPassword = confirmationError;
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const normalizedEmail = normalizeEmail(fields.email);
    try {
      await apiRequest<unknown>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: fields.name.trim(),
          email: normalizedEmail,
          address: fields.address.trim(),
          password: fields.password,
        }),
      });
      navigate(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`, { replace: true });
    } catch (error) {
      setErrors((current) => ({ ...current, ...apiFieldErrors(error) }));
      setFormError(apiMessage(error, "We could not create your account. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      description="Join StoreRate to discover stores and share useful feedback."
    >
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {formError ? <InlineAlert>{formError}</InlineAlert> : null}
        <InputField
          id="register-name"
          label="Full name"
          value={fields.name}
          onChange={updateField("name")}
          error={errors.name}
          hint="20-60 characters, as required for the platform."
          autoComplete="name"
          required
        />
        <InputField
          id="register-email"
          label="Email address"
          type="email"
          value={fields.email}
          onChange={updateField("email")}
          error={errors.email}
          autoComplete="email"
          required
        />
        <InputField
          id="register-address"
          label="Address"
          value={fields.address}
          onChange={updateField("address")}
          error={errors.address}
          hint="Up to 400 characters."
          autoComplete="street-address"
          maxLength={400}
          multiline
          required
        />
        <PasswordInput
          id="register-password"
          label="Password"
          value={fields.password}
          onChange={updateField("password")}
          error={errors.password}
          hint="8-16 characters, including an uppercase letter and a special character."
          autoComplete="new-password"
          required
        />
        <PasswordInput
          id="register-confirm-password"
          label="Confirm password"
          value={fields.confirmPassword}
          onChange={updateField("confirmPassword")}
          error={errors.confirmPassword}
          autoComplete="new-password"
          required
        />
        <button
          className="button button--primary button--full"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-card__footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

function maskedEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return "your email address";
  }
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"•".repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const email = normalizeEmail(searchParams.get("email") ?? "");
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const updateDigit = (index: number, rawValue: string) => {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) {
      return;
    }
    event.preventDefault();
    setDigits(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ""));
    inputs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  const code = digits.join("");
  const submitVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      setFormError("Return to registration and enter your email address again.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setFormError("Enter the six-digit code from your email.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    try {
      await apiRequest<unknown>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, otp: code }),
      });
      showToast("Email verified. You can now sign in.", "success");
      navigate("/login", { replace: true });
    } catch (error) {
      setFormError(apiMessage(error, "We could not verify that code. Please try again."));
      setDigits(Array.from({ length: 6 }, () => ""));
      inputs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (!email || resendSeconds > 0) {
      return;
    }
    setIsResending(true);
    setFormError("");
    try {
      await apiRequest<unknown>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setResendSeconds(60);
      showToast("A new verification code has been sent.", "success");
    } catch (error) {
      setFormError(apiMessage(error, "We could not resend the code. Please try again."));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      description={`Enter the code we sent to ${maskedEmail(email)}. It expires after 10 minutes.`}
    >
      <form className="form-stack" onSubmit={submitVerification} noValidate>
        {formError ? <InlineAlert>{formError}</InlineAlert> : null}
        <fieldset className="otp-fieldset" disabled={isSubmitting}>
          <legend>Six-digit verification code</legend>
          <div className="otp-inputs" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputs.current[index] = element;
                }}
                className="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(event) => updateDigit(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                aria-label={`Verification code digit ${index + 1}`}
              />
            ))}
          </div>
        </fieldset>
        <button
          className="button button--primary button--full"
          type="submit"
          disabled={isSubmitting || !email}
        >
          {isSubmitting ? "Verifying…" : "Verify email"}
        </button>
      </form>
      <div className="verification-actions">
        <p>
          Didn’t receive a code?{" "}
          <button
            type="button"
            className="text-button"
            onClick={resendCode}
            disabled={isResending || resendSeconds > 0 || !email}
          >
            {isResending
              ? "Sending…"
              : resendSeconds > 0
                ? `Resend in ${resendSeconds}s`
                : "Resend code"}
          </button>
        </p>
        <Link to="/register">Use a different email address</Link>
      </div>
    </AuthLayout>
  );
}
