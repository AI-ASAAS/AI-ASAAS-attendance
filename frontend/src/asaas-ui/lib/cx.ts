/** Joins truthy class names. */
export const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');
