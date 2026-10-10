// @vitest-environment jsdom
import type { Household } from '@tma80/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ExclusionsValue } from './exclusions.ts';
import { ExclusionsField, HouseholdField } from './PreferenceFields.tsx';

function Question({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 id="q">Вопрос</h1>
      {children}
    </>
  );
}

describe('HouseholdField', () => {
  it('is a radio group named by the question; one answer at a time', async () => {
    const onChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState<Household | null>(null);
      return (
        <Question>
          <HouseholdField
            value={value}
            onChange={(next) => {
              onChange(next);
              setValue(next);
            }}
            labelledBy="q"
          />
        </Question>
      );
    }
    render(<Controlled />);
    expect(screen.getByRole('group', { name: 'Вопрос' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);

    await userEvent.click(screen.getByText('Мы вдвоём'));
    expect(onChange).toHaveBeenLastCalledWith('couple');
    expect(screen.getByRole('radio', { name: /Мы вдвоём/ })).toBeChecked();

    await userEvent.click(screen.getByText('Я один'));
    expect(screen.getByRole('radio', { name: /Я один/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Мы вдвоём/ })).not.toBeChecked();
  });
});

describe('ExclusionsField', () => {
  const none: ExclusionsValue = { exclusions: [], customExclusions: [] };

  function Controlled({ initial = none }: { initial?: ExclusionsValue }) {
    const [value, setValue] = useState<ExclusionsValue>(initial);
    return (
      <Question>
        <ExclusionsField value={value} onChange={setValue} labelledBy="q" />
        <output data-testid="tags">{value.exclusions.join(',')}</output>
        <output data-testid="custom">{value.customExclusions.join(',')}</output>
      </Question>
    );
  }

  it('offers meat, spicy and gluten; several answers or none; no pork option', async () => {
    render(<Controlled />);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(boxes.every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    expect(screen.queryByRole('checkbox', { name: /Свинина/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Мясо/ })).toHaveAccessibleName(/свинину/);

    await userEvent.click(screen.getByRole('checkbox', { name: /Острое/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Глютен/ }));
    expect(screen.getByTestId('tags')).toHaveTextContent('spicy,gluten');
    await userEvent.click(screen.getByRole('checkbox', { name: /Острое/ }));
    expect(screen.getByTestId('tags')).toHaveTextContent(/^gluten$/);
  });

  it('adds own words with the button or Enter and removes them by chip', async () => {
    render(<Controlled />);
    const input = screen.getByRole('textbox', { name: 'Своё' });
    await userEvent.type(input, '  Кинза ');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(screen.getByTestId('custom')).toHaveTextContent('кинза');
    expect(input).toHaveValue('');

    await userEvent.type(input, 'Грибы{Enter}');
    expect(screen.getByTestId('custom')).toHaveTextContent('кинза,грибы');
    const list = screen.getByRole('list', { name: 'Ваши исключения' });
    expect(list.querySelectorAll('li')).toHaveLength(2);

    const remove = screen.getByRole('button', { name: 'Удалить «кинза»' });
    expect(remove).toHaveClass('size-11');
    await userEvent.click(remove);
    expect(screen.getByTestId('custom')).toHaveTextContent(/^грибы$/);
    expect(input).toHaveFocus();
  });

  it('explains why a word is not added', async () => {
    render(<Controlled initial={{ exclusions: [], customExclusions: ['свёкла'] }} />);
    const input = screen.getByRole('textbox', { name: 'Своё' });

    await userEvent.type(input, 'к{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/Слишком коротко/);

    await userEvent.clear(input);
    expect(input).toHaveAttribute('aria-invalid', 'false');
    await userEvent.type(input, 'СВЕКЛА{Enter}');
    expect(input).toHaveAccessibleDescription(/уже есть в списке/);
    expect(screen.getByTestId('custom')).toHaveTextContent(/^свёкла$/);

    // An empty field adds nothing and shows no error.
    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('is disabled together with the group', () => {
    render(
      <Question>
        <ExclusionsField
          value={{ exclusions: [], customExclusions: ['кинза'] }}
          onChange={() => undefined}
          labelledBy="q"
          disabled
        />
      </Question>,
    );
    expect(screen.getByRole('textbox', { name: 'Своё' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Удалить «кинза»' })).toBeDisabled();
  });
});
