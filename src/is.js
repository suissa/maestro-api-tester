export function is(what, value) {
  if (what === false) return (value) => !(value);
  if (what === true) return (value) => !!(value);
  return (actual) => actual === value;
}

export const isFalse = is(false, undefined);
export const isTrue = is(true, undefined);
