import type { ReactNode } from 'react';
import { kitText } from '../lib/i18n';
import { Button } from './Button';
import { FormError } from './Field';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
  error?: unknown;
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel = kitText('delete'),
  onConfirm,
  onClose,
  pending,
  error,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" icon="trash" onClick={onConfirm} disabled={pending}>
            {pending ? kitText('deleting') : confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {kitText('cancel')}
          </Button>
        </>
      }
    >
      <div className="form">
        <p className="muted">{children}</p>
        <FormError error={error} />
      </div>
    </Modal>
  );
}
