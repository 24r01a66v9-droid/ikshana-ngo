import { describe, expect, it } from "vitest";
import { reorderMembersById } from "./teamUtils";

describe("reorderMembersById", () => {
  it("reorders the targeted member and renumbers display order", () => {
    const members = [
      { id: "a", displayOrder: 1 },
      { id: "b", displayOrder: 2 },
      { id: "c", displayOrder: 3 },
    ] as Array<{ id: string; displayOrder: number }>;

    const reordered = reorderMembersById(members, "b", "c");

    expect(reordered.map((member) => member.id)).toEqual(["a", "c", "b"]);
    expect(reordered.map((member) => member.displayOrder)).toEqual([1, 2, 3]);
  });
});
