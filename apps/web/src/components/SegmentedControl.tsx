import { cx } from './cx.ts';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group, e.g. «Подборка» or «Период рейтинга». */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A two- or three-way switch on a track (Будни / Выходные, Эта неделя / Всё время): toggle buttons
 * with `aria-pressed`, the chosen one on a white pill. Each segment is at least 44 px high.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex gap-2 rounded-tile bg-track p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(option.value);
            }}
            className={cx(
              'min-h-11 flex-1 rounded-segment text-base transition-colors',
              active ? 'bg-surface font-bold text-ink shadow-card' : 'font-semibold text-muted',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
