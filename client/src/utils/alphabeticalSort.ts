/**
 * Utility function to sort items alphabetically by first and second letters
 * This sorting logic will be maintained when new items are added
 */

export interface SortableItem {
  name: string;
  [key: string]: any; // Allow additional properties
}

export const sortAlphabetically = <T extends SortableItem>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    
    // Compare first letter
    if (nameA[0] !== nameB[0]) {
      return nameA[0].localeCompare(nameB[0]);
    }
    
    // If first letters are the same, compare second letter
    const secondA = nameA[1] || '';
    const secondB = nameB[1] || '';
    if (secondA !== secondB) {
      return secondA.localeCompare(secondB);
    }
    
    // If first two letters are the same, continue with full alphabetical sort
    return nameA.localeCompare(nameB);
  });
};

/**
 * Helper function to add new items to a sorted list while maintaining alphabetical order
 */
export const addItemAlphabetically = <T extends SortableItem>(
  existingItems: T[], 
  newItem: T
): T[] => {
  const updatedItems = [...existingItems, newItem];
  return sortAlphabetically(updatedItems);
};

/**
 * Helper function to get the expected position for a new item in a sorted list
 */
export const getInsertPosition = <T extends SortableItem>(
  sortedItems: T[], 
  newItemName: string
): number => {
  const newItem = { name: newItemName } as T;
  const sortedWithNew = sortAlphabetically([...sortedItems, newItem]);
  return sortedWithNew.findIndex(item => item.name === newItemName);
};