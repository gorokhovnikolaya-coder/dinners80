import {
  addCustomExclusion,
  CUSTOM_EXCLUSION_MAX_LENGTH,
  CUSTOM_EXCLUSION_MIN_LENGTH,
  CUSTOM_EXCLUSIONS_MAX,
  DISH_TAGS,
  HOUSEHOLDS,
  WEEKDAY_MINUTES,
  type CustomExclusionError,
  type Household,
  type WeekdayMinutes,
} from '@tma80/shared';
import { useId, useRef, useState, type ReactNode } from 'react';

import { ru } from '../../i18n/ru.ts';
import { Button } from '../Button.tsx';
import { Chip } from '../Chip.tsx';
import { cx } from '../cx.ts';
import { IconClock, IconCouple, IconFamily, IconPerson, IconPlus } from '../icons.tsx';
import { OptionCard } from '../OptionCard.tsx';
import { toggleExclusion, type ExclusionsValue } from './exclusions.ts';

/**
 * Controls of the onboarding answers. The onboarding and the profile settings (task 13) use the
 * same components, as the ТЗ requires; both screens are light.
 */
interface FieldProps<Value, Selected = Value> {
  value: Value;
  onChange: (value: Selected) => void;
  /** Id of the visible question that names the group. */
  labelledBy: string;
  disabled?: boolean | undefined;
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
        />
      ))}
    </Group>
  );
}

const customTexts = ru.preferences.customExclusions;

const customErrorText = (error: Exclude<CustomExclusionError, 'empty'>): string => {
  const { errors } = customTexts;
  switch (error) {
    case 'tooShort':
      return errors.tooShort(CUSTOM_EXCLUSION_MIN_LENGTH);
    case 'tooLong':
      return errors.tooLong(CUSTOM_EXCLUSION_MAX_LENGTH);
    case 'limit':
      return errors.limit(CUSTOM_EXCLUSIONS_MAX);
    case 'noLetter':
    case 'duplicate':
      return errors[error];
  }
};

/**
 * «Своё»: the user's own exclusions as free text. A word is added with «Добавить» or Enter and
 * shown as a chip with a «×» button; invalid input explains why it was not added. Disabled
 * together with the surrounding `fieldset`.
 */
function CustomExclusionsInput({
  words,
  onChange,
}: {
  words: string[];
  onChange: (words: string[]) => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<Exclude<CustomExclusionError, 'empty'> | null>(null);

  const add = () => {
    const result = addCustomExclusion(words, text);
    if ('error' in result) {
      setError(result.error === 'empty' ? null : result.error);
      return;
    }
    onChange(result.list);
    setText('');
    setError(null);
  };

  const remove = (word: string) => {
    onChange(words.filter((item) => item !== word));
    setError(null);
    // The removed chip's button disappears: keep the focus in the field.
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="flex min-h-11 items-end text-xl font-extrabold">
        {customTexts.label}
      </label>
      <p id={hintId} className="text-sm text-muted">
        {customTexts.hint}
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={text}
          maxLength={CUSTOM_EXCLUSION_MAX_LENGTH}
          autoComplete="off"
          placeholder={customTexts.placeholder}
          aria-describedby={`${hintId} ${errorId}`}
          aria-invalid={error !== null}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            add();
          }}
          className={cx(
            'min-h-12 min-w-0 flex-1 rounded-button border-[1.5px] bg-surface px-4 text-lg text-ink',
            'placeholder:text-muted disabled:cursor-not-allowed disabled:bg-track',
            error === null ? 'border-muted' : 'border-accent-strong',
          )}
        />
        <Button variant="secondary" icon={<IconPlus size={20} />} onClick={add}>
          {customTexts.add}
        </Button>
      </div>
      <p
        id={errorId}
        aria-live="polite"
        className="text-sm font-semibold text-accent-strong empty:hidden"
      >
        {error === null ? '' : customErrorText(error)}
      </p>
      {words.length > 0 && (
        <ul aria-label={customTexts.list} className="flex flex-wrap gap-2">
          {words.map((word) => (
            <li key={word} className="max-w-full">
              <Chip
                onRemove={() => {
                  remove(word);
                }}
                removeLabel={customTexts.remove(word)}
              >
                {word}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Step 3 «Что не ест»: any of meat / spicy / gluten, or nothing, plus own words («Своё»), e.g.
 * «кинза». Pork is meat: there is no separate option.
 */
export function ExclusionsField({
  value,
  onChange,
  labelledBy,
  disabled,
}: FieldProps<ExclusionsValue>) {
  return (
    <Group labelledBy={labelledBy} disabled={disabled}>
      {DISH_TAGS.map((tag) => {
        const text = ru.preferences.exclusions[tag];
        return (
          <OptionCard
            key={tag}
            type="checkbox"
            name="exclusions"
            value={tag}
            checked={value.exclusions.includes(tag)}
            onChange={(next) => {
              onChange({ ...value, exclusions: toggleExclusion(value.exclusions, tag, next) });
            }}
            title={text.title}
            description={'description' in text ? text.description : undefined}
          />
        );
      })}
      <CustomExclusionsInput
        words={value.customExclusions}
        onChange={(customExclusions) => {
          onChange({ ...value, customExclusions });
        }}
      />
    </Group>
  );
}
