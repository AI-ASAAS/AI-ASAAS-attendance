import type { ReactNode } from 'react';
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
  confirmLabel = 'حذف',
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
            {pending ? 'جارٍ الحذف…' : confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
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
