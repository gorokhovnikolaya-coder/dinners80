import { DISH_TAGS, isExclusionImplied, type DishTag } from '@tma80/shared';

/** How an exclusion option is shown: checked, and locked when another selection implies it. */
export interface ExclusionOptionState {
  tag: DishTag;
  checked: boolean;
  /** Pork while meat is selected: shown as checked and cannot be unchecked. */
  implied: boolean;
}

/**
 * Display state of every exclusion for the raw selection. A tag implied by another one (pork by
 * meat) is checked and locked; its own choice is kept in the selection and comes back when the
 * implying tag is unchecked.
 */
export function exclusionOptions(selection: readonly DishTag[]): ExclusionOptionState[] {
  return DISH_TAGS.map((tag) => {
    const implied = isExclusionImplied(tag, selection);
    return { tag, implied, checked: implied || selection.includes(tag) };
  });
}

/** The raw selection after a tag is checked or unchecked, in `DISH_TAGS` order. */
export function toggleExclusion(
  selection: readonly DishTag[],
  tag: DishTag,
  checked: boolean,
): DishTag[] {
  return DISH_TAGS.filter((item) => (item === tag ? checked : selection.includes(item)));
}
