// @vitest-environment jsdom
import type { DishTag, Household } from '@tma80/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

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
  function Controlled({ initial = [] }: { initial?: DishTag[] }) {
    const [value, setValue] = useState<DishTag[]>(initial);
    return (
      <Question>
        <ExclusionsField value={value} onChange={setValue} labelledBy="q" />
        <output data-testid="value">{value.join(',')}</output>
      </Question>
    );
  }

  it('allows several answers or none', async () => {
    render(<Controlled />);
    expect(screen.getAllByRole('checkbox').every((box) => !(box as HTMLInputElement).checked)).toBe(
      true,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /Острое/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Глютен/ }));
    expect(screen.getByTestId('value')).toHaveTextContent('spicy,gluten');
    await userEvent.click(screen.getByRole('checkbox', { name: /Острое/ }));
    expect(screen.getByTestId('value')).toHaveTextContent(/^gluten$/);
  });

  it('meat checks and locks pork; unchecking meat unlocks it', async () => {
    render(<Controlled />);
    const pork = () => screen.getByRole('checkbox', { name: /Свинина/ });
    await userEvent.click(screen.getByRole('checkbox', { name: /Мясо/ }));
    expect(pork()).toBeChecked();
    expect(pork()).toBeDisabled();
    expect(pork()).toHaveAccessibleName(/Уже исключена вместе с мясом/);

    await userEvent.click(screen.getByRole('checkbox', { name: /Мясо/ }));
    expect(pork()).not.toBeChecked();
    expect(pork()).toBeEnabled();
  });
});
