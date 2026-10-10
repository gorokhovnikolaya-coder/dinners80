import { DISH_TAGS, type DishTag } from '@tma80/shared';

/** Both kinds of «Что не ест» answers, as in the profile (`exclusions`, `customExclusions`). */
export interface ExclusionsValue {
  exclusions: DishTag[];
  customExclusions: string[];
}

/** The selection after a tag is checked or unchecked, in `DISH_TAGS` order. */
export function toggleExclusion(
  selection: readonly DishTag[],
  tag: DishTag,
  checked: boolean,
): DishTag[] {
  return DISH_TAGS.filter((item) => (item === tag ? checked : selection.includes(item)));
}
