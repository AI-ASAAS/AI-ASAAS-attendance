import faceCelebrate from '../assets/assistant/face-celebrate.webp';
import faceHappy from '../assets/assistant/face-happy.webp';
import faceSmile from '../assets/assistant/face-smile.webp';
import faceWaiting from '../assets/assistant/face-waiting.webp';
import robotWave from '../assets/assistant/robot-wave.webp';
import { cx } from '../lib/cx';
import { firstName } from '../lib/format';
import { kitText } from '../lib/i18n';

const srcOf = (asset: string | { src: string }) => (typeof asset === 'string' ? asset : asset.src);

/**
 * Asaas robot artwork (exported to WebP).
 * The full robot greets from outside the chat; inside it, only its face shows.
 */
const FACES = {
  smile: faceSmile,
  happy: faceHappy,
  waiting: faceWaiting,
  celebrate: faceCelebrate,
} as const;

export type AssistantMood = keyof typeof FACES;

export function AssistantFace({ mood = 'happy', size = 'md' }: { mood?: AssistantMood; size?: 'sm' | 'md' }) {
  return <img src={srcOf(FACES[mood])} alt="" className={cx('assistant-face', `assistant-face--${size}`)} draggable={false} />;
}

export function AssistantRobot({ className }: { className?: string }) {
  return <img src={srcOf(robotWave)} alt="" className={cx('assistant-robot', className)} draggable={false} />;
}

/** "Good morning" until noon, "good evening" after, with the first name only, in the page language. */
export function greeting(displayName: string, now = new Date()): string {
  const name = firstName(displayName);
  const salutation = kitText(now.getHours() < 12 ? 'goodMorning' : 'goodEvening');
  return name ? kitText('greetingName', { salutation, name }) : salutation;
}
