// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button, IconButton } from './Button.tsx';
import { Checkbox } from './Checkbox.tsx';
import { Chip } from './Chip.tsx';
import { ErrorState } from './ErrorState.tsx';
import { ProgressBar } from './ProgressBar.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import { Skeleton, SkeletonGroup } from './Skeleton.tsx';
import { Spinner } from './Spinner.tsx';
import { Switch } from './Switch.tsx';
import { TabBar, type TabBarItem } from './TabBar.tsx';

describe('Button', () => {
  it('is a real button of type "button" and does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Ок</Button>
        <Button onClick={onClick} disabled>
          Нет
        </Button>
      </>,
    );
    const ok = screen.getByRole('button', { name: 'Ок' });
    expect(ok).toHaveAttribute('type', 'button');
    await userEvent.click(ok);
    await userEvent.click(screen.getByRole('button', { name: 'Нет' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('loading shows a spinner, stays focusable and ignores clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button loading icon={<svg data-testid="icon" />} onClick={onClick}>
        Сохраняем…
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Сохраняем…' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeEnabled();
    expect(button.querySelector('[data-spinner]')).toBeInTheDocument();
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('without loading has no busy state and shows its icon', () => {
    render(<Button icon={<svg data-testid="icon" />}>Дальше</Button>);
    const button = screen.getByRole('button', { name: 'Дальше' });
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('IconButton takes its accessible name from the label', () => {
    render(<IconButton label="Назад" icon={<svg />} />);
    expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('is decorative and spins only without reduced motion', () => {
    const { container } = render(<Spinner size="sm" />);
    const spinner = container.querySelector('[data-spinner]');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(spinner).toHaveClass('size-4', 'motion-safe:animate-spin');
  });
});

describe('ProgressBar', () => {
  it('exposes the clamped value via ARIA', () => {
    render(<ProgressBar value={42} max={30} label="Страны" valueText="30 из 30" />);
    const bar = screen.getByRole('progressbar', { name: 'Страны' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '30');
    expect(bar).toHaveAttribute('aria-valuenow', '30');
    expect(bar).toHaveAttribute('aria-valuetext', '30 из 30');
  });

  it('draws the fill width from the ratio', () => {
    render(<ProgressBar value={15} max={30} label="Страны" />);
    const fill = screen.getByRole('progressbar').firstElementChild;
    expect(fill).toHaveStyle({ width: '50%' });
  });

  it('steps variant draws max segments with value filled', () => {
    render(<ProgressBar value={3} max={6} variant="steps" label="Шаги" />);
    const bar = screen.getByRole('progressbar', { name: 'Шаги' });
    expect(bar.children).toHaveLength(6);
    expect(bar.querySelectorAll('[data-filled]')).toHaveLength(3);
  });
});

describe('Checkbox', () => {
  function Controlled({ onChange }: { onChange: (checked: boolean) => void }) {
    const [checked, setChecked] = useState(false);
    return (
      <Checkbox
        checked={checked}
        onChange={(next) => {
          onChange(next);
          setChecked(next);
        }}
        label="Картофель"
        trailing="3 шт"
      />
    );
  }

  it('is a native checkbox with a label and reports the next state', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: /Картофель/ });
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText('Картофель'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(box).not.toBeChecked();
  });

  it('stays as the parent says when the parent ignores the change', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Лук" />);
    const box = screen.getByRole('checkbox', { name: 'Лук' });
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(box).not.toBeChecked();
  });

  it('does not change when disabled', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Соус" disabled />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Соус' }));
    expect(onChange).not.toHaveBeenCalled();
    // Dimmed like the rest of the row, not drawn as an active item.
    expect(screen.getByText('Соус')).toHaveClass('text-muted');
    expect(screen.getByText('Соус')).not.toHaveClass('text-ink');
  });
});

describe('Chip', () => {
  it('a static chip is not interactive', () => {
    render(<Chip tone="primary">Будний вечер</Chip>);
    expect(screen.getByText('Будний вечер')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('a toggle chip is a button with aria-pressed and reports the next state', async () => {
    const onToggle = vi.fn();
    render(
      <Chip selected onToggle={onToggle}>
        Без мяса
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Без мяса' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip);
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});

describe('TabBar', () => {
  const items: TabBarItem[] = [
    { id: 'dinner', label: 'Ужин', href: '/', icon: null },
    { id: 'map', label: 'Карта', href: '/map', icon: null },
    { id: 'friends', label: 'Друзья', href: '/friends', icon: null },
  ];

  it('marks only the active tab with aria-current="page"', () => {
    render(<TabBar items={items} activeId="map" label="Разделы" />);
    const nav = screen.getByRole('navigation', { name: 'Разделы' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Карта' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Ужин' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Друзья' })).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate with the item on a plain click', async () => {
    const onNavigate = vi.fn();
    render(<TabBar items={items} activeId="dinner" label="Разделы" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Друзья' }));
    expect(onNavigate).toHaveBeenCalledWith(items[2]);
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive tech, the group announces loading', () => {
    render(
      <SkeletonGroup label="Загрузка…">
        <Skeleton />
      </SkeletonGroup>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Загрузка…');
    expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('ErrorState', () => {
  it('announces the error and calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить данные.');
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no retry button without onRetry and disables it while retrying', () => {
    const { rerender } = render(<ErrorState title="Ошибка" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<ErrorState title="Ошибка" onRetry={() => undefined} retrying />);
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeDisabled();
  });
});

describe('SegmentedControl', () => {
  it('is a labelled group of toggle buttons; a press reports the value', async () => {
    function Controlled() {
      const [value, setValue] = useState<'week' | 'all'>('week');
      return (
        <SegmentedControl
          label="Период"
          options={[
            { value: 'week', label: 'Эта неделя' },
            { value: 'all', label: 'Всё время' },
          ]}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<Controlled />);
    expect(screen.getByRole('group', { name: 'Период' })).toBeInTheDocument();
    const week = screen.getByRole('button', { name: 'Эта неделя' });
    const all = screen.getByRole('button', { name: 'Всё время' });
    expect(week).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(all);
    expect(all).toHaveAttribute('aria-pressed', 'true');
    expect(week).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Switch', () => {
  function Controlled({ busy = false }: { busy?: boolean }) {
    const [on, setOn] = useState(false);
    return (
      <Switch
        checked={on}
        onChange={setOn}
        label="Напоминание об ужине"
        description="Бот пришлёт идею ужина"
        busy={busy}
      />
    );
  }

  it('is a native switch named by its label, toggled by the whole row', async () => {
    render(<Controlled />);
    const toggle = screen.getByRole('switch', { name: 'Напоминание об ужине' });
    expect(toggle).toHaveAccessibleDescription('Бот пришлёт идею ужина');
    expect(toggle).not.toBeChecked();
    await userEvent.click(screen.getByText('Напоминание об ужине'));
    expect(toggle).toBeChecked();
    await userEvent.keyboard(' ');
    expect(toggle).not.toBeChecked();
  });

  it('ignores presses while busy and when disabled', async () => {
    const onChange = vi.fn();
    render(
      <>
        <Controlled busy />
        <Switch checked={false} onChange={onChange} label="Недоступно" disabled />
      </>,
    );
    const busy = screen.getByRole('switch', { name: 'Напоминание об ужине' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(busy);
    expect(busy).not.toBeChecked();
    const disabled = screen.getByRole('switch', { name: 'Недоступно' });
    expect(disabled).toBeDisabled();
    await userEvent.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
  });
});
