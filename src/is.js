export function is(what, value) {
  return (actual) => {
    if (what === false) return !(actual);
    if (what === true) return !!(actual);
    return actual === value;
  };
}

export const isFalse = (value) => is(false, value)(value);
export const isTrue = (value) => is(true, value)(value);
