"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  clampDecimals,
  normalizeOnBlur,
  sanitizeDecimalInput,
} from "@/lib/numberFormat";

type NumericInputProps = {
  value: string;
  onValueChange: (next: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  decimals?: number; // default 2 for price-like fields
  autoSelectOnFocus?: boolean;
  errorText?: string; // optionally override default error text
};

export function NumericInput(props: NumericInputProps) {
  const {
    value,
    onValueChange,
    id,
    name,
    placeholder,
    className,
    disabled,
    required,
    min,
    max,
    decimals = 2,
    autoSelectOnFocus = true,
    errorText,
  } = props;

  const [display, setDisplay] = React.useState<string>(value ?? "");
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    // Keep local display synced if parent value changes externally
    setDisplay(value ?? "");
  }, [value]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let cleaned = sanitizeDecimalInput(raw, false);
    // Support typing starting with "." by coercing to "0."
    if (cleaned.startsWith(".")) cleaned = "0" + cleaned;
    const hasTrailingDot = cleaned.endsWith(".");
    const clamped = clampDecimals(cleaned, Math.max(0, decimals));
    // Preserve a trailing dot during typing (e.g., "0.")
    const next = hasTrailingDot && !clamped.includes(".") ? clamped + "." : clamped;
    setDisplay(next);
    setError("");
    onValueChange(next);
  };

  const onBlur = () => {
    const {
      display: fixed,
      normalized,
      valid,
    } = normalizeOnBlur(display, {
      allowNegative: false,
      decimals,
    });
    // Range checks if provided
    if (valid) {
      const n = Number(normalized);
      if (min != null && n < min) {
        setError(errorText || `Must be ≥ ${min.toFixed(decimals)}`);
      } else if (max != null && n > max) {
        setError(errorText || `Must be ≤ ${max.toFixed(decimals)}`);
      } else {
        setError("");
      }
    } else if (normalized === "") {
      // Allow empty if not required
      if (required) setError(errorText || "Enter a valid number");
      else setError("");
    } else {
      setError(errorText || "Enter a valid number");
    }
    setDisplay(fixed);
    if (fixed !== value) onValueChange(fixed);
  };

  return (
    <div className="min-w-0">
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={display}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={(e) => {
          if (autoSelectOnFocus) {
            // Select all for quick overwrite
            // setTimeout to ensure after focus
            setTimeout(() => e.target.select(), 0);
          }
        }}
        className={className}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        pattern={"^[0-9]*[.,]?[0-9]*$"}
        autoComplete="off"
        spellCheck={false}
      />
      {error ? (
        <div className="mt-1 text-[11px] text-destructive">{error}</div>
      ) : null}
    </div>
  );
}

export default NumericInput;
