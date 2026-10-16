export type Predicate<T> = (value: T) => boolean;

export function is<T>(what: T, expected?: T): Predicate<T> {
  if (what === false) return (value) => !value;
  if (what === true) return (value) => !!value;
  return (value) => value === expected;
}

export const isFalse = (value: unknown): boolean => is(false, value)(value as boolean);
export const isTrue = (value: unknown): boolean => is(true, value)(value as boolean);
