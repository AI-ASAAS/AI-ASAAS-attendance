import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';
import { CURRENCY } from '../lib/format';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className="input" {...props}>
      {children}
    </select>
  );
}

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null;
  onChange: (value: number | null) => void;
}

/** Whole-rial amount with live thousands separators. */
export function MoneyInput({ value, onChange, ...props }: MoneyInputProps) {
  return (
    <div className="input-affix">
      <input
        className="input num"
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        value={value === null ? '' : value.toLocaleString('en-US')}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
          onChange(digits ? Number(digits) : null);
        }}
        {...props}
      />
      <span className="input-affix__suffix">{CURRENCY}</span>
    </div>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="form-error">{error instanceof Error ? error.message : String(error)}</div>;
}
