import { createPostInteractionGate } from "../../src/entry/components/post-interaction-gate";

describe("post interaction gate", () => {
  it("allows one reflective Risk Score reduction per post in a page session", () => {
    const gate = createPostInteractionGate();

    expect(gate.claim("post-1")).toBe(true);
    expect(gate.claim("post-1")).toBe(false);
    expect(gate.claim("post-2")).toBe(true);
  });
});
