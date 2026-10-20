/**
 * Asaas UI kit: Thmanyah type, brand tokens, liquid-glass components and the
 * assistant widget. Import the styles once (main.tsx): `import './asaas-ui/styles/index.css'`.
 */
export { Ambient } from './ui/Ambient';
export { Button } from './ui/Button';
export { ConfirmDialog } from './ui/ConfirmDialog';
export { EmptyState, ErrorState, Skeleton } from './ui/Feedback';
export { Field, FormError, MoneyInput, Select, TextArea, TextInput } from './ui/Field';
export { Card, Glass } from './ui/Glass';
export { Icon, type IconName } from './ui/Icon';
export { Modal } from './ui/Modal';
export { MonthSwitcher } from './ui/MonthSwitcher';
export { PasswordInput, PasswordStrength } from './ui/PasswordInput';
export { Segmented } from './ui/Segmented';
export { ProgressBar, ProgressRing, Stat } from './ui/Stat';
export { Avatar, type ContributionStatus, STATUS_META, StatusPill } from './ui/Status';
export { ToastProvider, useToast } from './ui/Toast';
export { Stretch, Swash, swashIndex } from './ui/Typography';

export { cx } from './lib/cx';
export * from './lib/format';
export { currentPeriod, periodBounds, shiftPeriod, today } from './lib/period';
export { useTheme } from './lib/useTheme';

export { AssistantFace, AssistantRobot, greeting } from './assistant/AssistantAvatar';
export type { AssistantAnswer, AssistantConfig, AssistantMessage } from './assistant/AssistantPanel';
export { AssistantWidget } from './assistant/AssistantWidget';
