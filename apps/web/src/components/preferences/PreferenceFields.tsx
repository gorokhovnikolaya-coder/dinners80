import {
  HOUSEHOLDS,
  WEEKDAY_MINUTES,
  type DishTag,
  type Household,
  type WeekdayMinutes,
} from '@tma80/shared';
import type { ReactNode } from 'react';

import { ru } from '../../i18n/ru.ts';
import { IconClock, IconCouple, IconFamily, IconPerson } from '../icons.tsx';
import { OptionCard, type OptionCardTone } from '../OptionCard.tsx';
import { exclusionOptions, toggleExclusion } from './exclusions.ts';

/**
 * Controls of the onboarding answers. The onboarding (dark) and the profile settings (light,
 * task 13) use the same components, as the ТЗ requires.
 */
interface FieldProps<Value, Selected = Value> {
  value: Value;
  onChange: (value: Selected) => void;
  /** Id of the visible question that names the group. */
  labelledBy: string;
  disabled?: boolean | undefined;
  tone?: OptionCardTone | undefined;
}

function Group({
  labelledBy,
  disabled,
  children,
}: {
  labelledBy: string;
  disabled?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <fieldset
      aria-labelledby={labelledBy}
      disabled={disabled}
      className="flex min-w-0 flex-col gap-3"
    >
      {children}
    </fieldset>
  );
}

const HOUSEHOLD_ICONS: Record<Household, ReactNode> = {
  solo: <IconPerson size={28} />,
  couple: <IconCouple size={28} />,
  family: <IconFamily size={28} />,
};

/** Step 1 «Кто ест»: one of solo / couple / family. */
export function HouseholdField({
  value,
  onChange,
  labelledBy,
  disabled,
  tone,
}: FieldProps<Household | null, Household>) {
  return (
    <Group labelledBy={labelledBy} disabled={disabled}>
      {HOUSEHOLDS.map((household) => (
        <OptionCard
          key={household}
          type="radio"
          name="household"
          value={household}
          checked={value === household}
          onChange={() => {
            onChange(household);
          }}
          title={ru.preferences.household[household].title}
          description={ru.preferences.household[household].description}
          icon={HOUSEHOLD_ICONS[household]}
          tone={tone}
        />
      ))}
    </Group>
  );
}

/** Step 2 «Время на ужин в будни»: 20 / 30 / 45 minutes. */
export function WeekdayMinutesField({
  value,
  onChange,
  labelledBy,
  disabled,
  tone,
}: FieldProps<WeekdayMinutes | null, WeekdayMinutes>) {
  return (
    <Group labelledBy={labelledBy} disabled={disabled}>
      {WEEKDAY_MINUTES.map((minutes) => (
        <OptionCard
          key={minutes}
          type="radio"
          name="weekdayMinutes"
          value={String(minutes)}
          checked={value === minutes}
          onChange={() => {
            onChange(minutes);
          }}
          title={ru.preferences.weekdayMinutes(minutes)}
          icon={<IconClock size={28} />}
          tone={tone}
        />
      ))}
    </Group>
  );
}

/**
 * Step 3 «Что не ест»: any of pork / meat / spicy / gluten, or nothing. `value` is the raw
 * selection; pork is shown checked and locked while meat is selected (pork is meat too).
 */
export function ExclusionsField({
  value,
  onChange,
  labelledBy,
  disabled,
  tone,
}: FieldProps<DishTag[]>) {
  return (
    <Group labelledBy={labelledBy} disabled={disabled}>
      {exclusionOptions(value).map(({ tag, checked, implied }) => {
        const text = ru.preferences.exclusions[tag];
        return (
          <OptionCard
            key={tag}
            type="checkbox"
            name="exclusions"
            value={tag}
            checked={checked}
            disabled={implied}
            onChange={(next) => {
              onChange(toggleExclusion(value, tag, next));
            }}
            title={text.title}
            description={
              implied
                ? ru.preferences.impliedByMeat
                : 'description' in text
                  ? text.description
                  : undefined
            }
            tone={tone}
          />
        );
      })}
    </Group>
  );
}
