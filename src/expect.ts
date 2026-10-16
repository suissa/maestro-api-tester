import assert from "node:assert/strict";
import { isFalse, isTrue } from "./is.js";

export const I = {
  hope: {
    this() {
      return {
        isFalse(value: unknown): void {
          assert.equal(isFalse(value), true);
        },
        isTrue(value: unknown): void {
          assert.equal(isTrue(value), true);
        },
      };
    },
  },
};
