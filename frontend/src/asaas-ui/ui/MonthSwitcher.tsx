import { formatPeriod } from '../lib/format';
import { currentPeriod, shiftPeriod } from '../lib/period';
import { Button } from './Button';

export function MonthSwitcher({ value, onChange }: { value: string; onChange: (period: string) => void }) {
  const isCurrent = value === currentPeriod();
  return (
    <div className="month-switcher" role="group" aria-label="اختيار الشهر">
      <Button variant="ghost" size="sm" icon="chevronRight" label="الشهر السابق" onClick={() => onChange(shiftPeriod(value, -1))} />
      <span className="month-switcher__label">
        <button
          type="button"
          onClick={() => onChange(currentPeriod())}
          title={isCurrent ? undefined : 'العودة للشهر الحالي'}
        >
          {formatPeriod(value)}
        </button>
      </span>
      <Button variant="ghost" size="sm" icon="chevronLeft" label="الشهر التالي" onClick={() => onChange(shiftPeriod(value, 1))} />
    </div>
  );
}
