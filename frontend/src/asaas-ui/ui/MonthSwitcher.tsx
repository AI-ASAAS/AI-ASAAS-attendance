import { formatPeriod } from '../lib/format';
import { kitText } from '../lib/i18n';
import { currentPeriod, shiftPeriod } from '../lib/period';
import { Button } from './Button';

export function MonthSwitcher({ value, onChange }: { value: string; onChange: (period: string) => void }) {
  const isCurrent = value === currentPeriod();
  return (
    <div className="month-switcher" role="group" aria-label={kitText('pickMonth')}>
      <Button variant="ghost" size="sm" icon="chevronRight" label={kitText('prevMonth')} onClick={() => onChange(shiftPeriod(value, -1))} />
      <span className="month-switcher__label">
        <button
          type="button"
          onClick={() => onChange(currentPeriod())}
          title={isCurrent ? undefined : kitText('backToThisMonth')}
        >
          {formatPeriod(value)}
        </button>
      </span>
      <Button variant="ghost" size="sm" icon="chevronLeft" label={kitText('nextMonth')} onClick={() => onChange(shiftPeriod(value, 1))} />
    </div>
  );
}
