export interface TeamMemberLike {
  id: string;
  displayOrder: number;
}

export const reorderMembersById = <T extends TeamMemberLike>(
  members: T[],
  draggedId: string,
  targetId: string,
): T[] => {
  const items = members.map((member) => ({ ...member }));
  const fromIndex = items.findIndex((member) => member.id === draggedId);
  const toIndex = items.findIndex((member) => member.id === targetId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }

  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  items.forEach((item, index) => {
    item.displayOrder = index + 1;
  });

  return items;
};
