import { type InputHTMLAttributes, useState } from 'react';
import { kitText } from '../lib/i18n';
import { passwordStrength, strengthLabel } from '../lib/passwordStrength';
import { Icon } from './Icon';

/** Password field with a show/hide toggle. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input className="input" dir="ltr" type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={kitText(visible ? 'hidePassword' : 'showPassword')}
        aria-pressed={visible}
        title={kitText(visible ? 'hide' : 'show')}
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  );
}

/** Four-segment strength meter; informative only, never blocks submission. */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const level = passwordStrength(password);
  return (
    <div className="strength" data-level={level} aria-live="polite">
      <div className="strength__bar" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={step <= Math.max(level, 1) ? 'strength__seg is-on' : 'strength__seg'} />
        ))}
      </div>
      <span className="strength__label">{kitText('passwordStrength')}: {strengthLabel(level)}</span>
    </div>
  );
}
