'use client';
import AsasApp from '@/components/asas/AsasApp';

export default function AttendPage({ forcedAction, defaultAction }) {
  return <AsasApp defaultAction={forcedAction || defaultAction || "auto"} />;
}
