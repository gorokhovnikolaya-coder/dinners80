import './dev-ui.css';

import type { Household } from '@tma80/shared';
import { useState, type ReactNode } from 'react';

import { Button, IconButton } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { Chip } from '../components/Chip.tsx';
import { ErrorState } from '../components/ErrorState.tsx';
import {
  IconBack,
  IconCart,
  IconClose,
  IconDinner,
  IconFriends,
  IconMap,
  IconPlus,
  IconRefresh,
} from '../components/icons.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import type { ExclusionsValue } from '../components/preferences/exclusions.ts';
import { ExclusionsField, HouseholdField } from '../components/preferences/PreferenceFields.tsx';
import { Skeleton, SkeletonGroup } from '../components/Skeleton.tsx';
import { SegmentedControl } from '../components/SegmentedControl.tsx';
import { Spinner } from '../components/Spinner.tsx';
import { Switch } from '../components/Switch.tsx';
import { TabBar, type TabBarItem } from '../components/TabBar.tsx';
import { ru, ruDevUi as t } from '../i18n/ru.ts';

/** Colour tokens shown as swatches; values are read from the CSS variables, not duplicated. */
const SWATCHES = [
  'bg',
  'surface',
  'track',
  'divider',
  'border',
  'ink',
  'ink-2',
  'muted',
  'primary',
  'primary-strong',
  'primary-soft',
  'accent',
  'accent-strong',
  'accent-soft',
  'navy-2',
  'navy-3',
  'on-dark-muted',
  'amber',
] as const;

const TABS: readonly TabBarItem[] = [
  { id: 'dinner', label: ru.tabs.dinner, href: '#dinner', icon: <IconDinner /> },
  { id: 'map', label: ru.tabs.map, href: '#map', icon: <IconMap /> },
  { id: 'friends', label: ru.tabs.friends, href: '#friends', icon: <IconFriends /> },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-display text-4xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Dev-only gallery of the design tokens and base components (`/dev/ui`). */
export function DevUiPage() {
  const [chips, setChips] = useState<Record<string, boolean>>({ noMeat: true, noFish: false });
  const [checks, setChecks] = useState<Record<string, boolean>>({
    beef: false,
    potato: true,
    rice: false,
    tomato: true,
  });
  const [tab, setTab] = useState('dinner');
  const [segment, setSegment] = useState<'week' | 'all'>('week');
  const [switches, setSwitches] = useState({ on: true, off: false });
  const [retries, setRetries] = useState(0);
  const [household, setHousehold] = useState<Household | null>('couple');
  const [exclusions, setExclusions] = useState<ExclusionsValue>({
    exclusions: ['meat'],
    customExclusions: ['кинза'],
  });
  const [removable, setRemovable] = useState<string[]>([t.chips.removable]);

  const toggleCheck = (key: string) => (checked: boolean) => {
    setChecks((prev) => ({ ...prev, [key]: checked }));
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-5 pt-10 pb-12">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-6xl font-bold">{t.title}</h1>
        <p className="text-md font-semibold text-muted">{t.subtitle}</p>
      </header>

      <Section id="ui-colors" title={t.sections.colors}>
        <ul className="grid grid-cols-3 gap-2">
          {SWATCHES.map((name) => (
            <li key={name} className="flex flex-col gap-1">
              <span
                className="h-10 rounded-tile border border-track"
                style={{ backgroundColor: `var(--color-${name})` }}
              />
              <code className="text-2xs text-ink-2">{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="ui-typography" title={t.sections.typography}>
        <p className="font-display text-6xl font-bold">{t.typography.display}</p>
        <p className="text-base text-ink-2">{t.typography.body}</p>
        <p className="text-md font-semibold text-muted">{t.typography.caption}</p>
      </Section>

      <Section id="ui-button" title={t.sections.button}>
        <Button variant="accent" size="lg" fullWidth>
          {t.buttons.accent}
        </Button>
        <Button variant="primary" fullWidth icon={<IconPlus size={20} />}>
          {t.buttons.primary}
        </Button>
        <Button variant="secondary" fullWidth icon={<IconRefresh size={18} />}>
          {t.buttons.secondary}
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">{t.buttons.medium}</Button>
          <Button variant="ghost">{t.buttons.ghost}</Button>
        </div>
        <Button variant="accent" fullWidth disabled>
          {t.buttons.disabled}
        </Button>
        <Button variant="primary" fullWidth loading>
          {t.buttons.loading}
        </Button>
        <div className="flex items-center gap-3 rounded-card bg-track p-3">
          <IconButton label={t.buttons.back} icon={<IconBack size={20} />} />
          <IconButton
            label={t.buttons.cart}
            icon={<IconCart />}
            variant="outline"
            size="lg"
            className="bg-surface"
          />
          <IconButton label={t.buttons.close} icon={<IconClose size={18} />} variant="muted" />
        </div>
        <Card tone="inverse" className="flex flex-col gap-3">
          <Button variant="inverse" size="lg" fullWidth>
            {t.buttons.inverse}
          </Button>
          <Button variant="inverse" size="lg" fullWidth loading>
            {t.buttons.loading}
          </Button>
          <Button variant="outlineDark" size="lg" fullWidth>
            {t.buttons.outlineDark}
          </Button>
          <IconButton label={t.buttons.close} icon={<IconClose size={18} />} variant="dark" />
        </Card>
      </Section>

      <Section id="ui-card" title={t.sections.card}>
        <Card as="article" padding="none" radius="lg">
          <div className="relative flex h-37.5 items-start bg-track p-3">
            <Chip tone="badge">{t.card.newCountry}</Chip>
          </div>
          <div className="flex flex-col gap-2 px-4 pt-3.5 pb-4">
            <p className="text-sm font-bold tracking-caps text-muted uppercase">{t.card.country}</p>
            <h3 className="font-display text-3xl font-bold">{t.card.dish}</h3>
            <div className="flex flex-wrap gap-2">
              <Chip>{t.card.time}</Chip>
              <Chip tone="primary">{t.card.weekday}</Chip>
              <Chip>{t.card.portions}</Chip>
            </div>
          </div>
        </Card>
        <Card tone="inverse" radius="lg" className="flex items-center gap-4 p-4.5">
          <p className="font-display text-9xl font-bold">
            {t.card.passportCount}
            <span className="text-2xl text-on-dark-muted">{t.card.passportTotal}</span>
          </p>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-md font-bold">{t.card.passportTitle}</p>
            <ProgressBar
              value={8}
              max={30}
              tone="dark"
              label={t.progress.countries}
              valueText={t.progress.countriesValue(8, 30)}
            />
          </div>
        </Card>
      </Section>

      <Section id="ui-chip" title={t.sections.chip}>
        <div className="flex flex-wrap gap-2">
          <Chip>{t.card.time}</Chip>
          <Chip tone="primary">{t.card.weekday}</Chip>
          <Chip tone="accent">{t.card.newCountry}</Chip>
          <Chip tone="badge">{t.card.newCountry}</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['noMeat', 'noFish'] as const).map((key) => (
            <Chip
              key={key}
              selected={chips[key] ?? false}
              onToggle={(selected) => {
                setChips((prev) => ({ ...prev, [key]: selected }));
              }}
            >
              {t.chips[key]}
            </Chip>
          ))}
          <Chip selected={false} onToggle={() => undefined} disabled>
            {t.chips.disabled}
          </Chip>
          {removable.map((word) => (
            <Chip
              key={word}
              onRemove={() => {
                setRemovable([]);
              }}
              removeLabel={ru.preferences.customExclusions.remove(word)}
            >
              {word}
            </Chip>
          ))}
        </div>
      </Section>

      <Section id="ui-tabbar" title={t.sections.tabBar}>
        <div className="overflow-hidden rounded-card border border-track">
          <TabBar
            items={TABS}
            activeId={tab}
            label={ru.tabs.label}
            onNavigate={(item) => {
              setTab(item.id);
            }}
          />
        </div>
      </Section>

      <Section id="ui-progress" title={t.sections.progressBar}>
        {[0, 8, 30].map((value) => (
          <ProgressBar
            key={value}
            value={value}
            max={30}
            label={t.progress.countries}
            valueText={t.progress.countriesValue(value, 30)}
          />
        ))}
        <ProgressBar
          value={15}
          max={30}
          size="md"
          label={t.progress.countries}
          valueText={t.progress.countriesValue(15, 30)}
        />
        <ProgressBar
          value={3}
          max={6}
          variant="steps"
          label={t.progress.steps}
          valueText={t.progress.stepsValue(3, 6)}
        />
        <Card tone="inverse">
          <ProgressBar
            value={1}
            max={3}
            variant="steps"
            tone="dark"
            size="sm"
            label={t.progress.onboarding}
            valueText={t.progress.stepsValue(1, 3)}
          />
        </Card>
      </Section>

      <Section id="ui-checkbox" title={t.sections.checkbox}>
        <Card padding="none" className="px-4 py-1.5">
          <Checkbox
            checked={checks.beef ?? false}
            onChange={toggleCheck('beef')}
            label={t.checkbox.beef}
            trailing={t.checkbox.beefQty}
          />
          <Checkbox
            divider
            checked={checks.potato ?? false}
            onChange={toggleCheck('potato')}
            label={t.checkbox.potato}
            trailing={t.checkbox.potatoQty}
          />
          <Checkbox
            divider
            checked={checks.rice ?? false}
            onChange={toggleCheck('rice')}
            label={t.checkbox.rice}
            description={t.checkbox.riceDish}
            trailing={t.checkbox.riceQty}
            strikeWhenChecked
          />
          <Checkbox
            divider
            checked={checks.tomato ?? false}
            onChange={toggleCheck('tomato')}
            label={t.checkbox.tomato}
            description={t.checkbox.tomatoDish}
            trailing={t.checkbox.tomatoQty}
            strikeWhenChecked
          />
          <Checkbox
            divider
            disabled
            checked={false}
            onChange={() => undefined}
            label={t.checkbox.disabled}
          />
        </Card>
      </Section>

      <Section id="ui-option-card" title={t.sections.optionCard}>
        <Card className="flex flex-col gap-3">
          <p id="ui-option-question" className="text-lg font-bold">
            {t.optionCard.question}
          </p>
          <HouseholdField
            value={household}
            onChange={setHousehold}
            labelledBy="ui-option-question"
          />
        </Card>
        <p id="ui-option-exclusions" className="text-lg font-bold">
          {t.optionCard.exclusionsQuestion}
        </p>
        <ExclusionsField
          value={exclusions}
          onChange={setExclusions}
          labelledBy="ui-option-exclusions"
        />
      </Section>

      <Section id="ui-segmented" title={t.sections.segmentedControl}>
        <SegmentedControl
          label={t.segmented.label}
          options={[
            { value: 'week', label: t.segmented.week },
            { value: 'all', label: t.segmented.all },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Section>

      <Section id="ui-switch" title={t.sections.switch}>
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <Switch
            checked={switches.on}
            onChange={(on) => {
              setSwitches((current) => ({ ...current, on }));
            }}
            label={t.switches.on}
            description={t.switches.onDescription}
          />
          <Switch
            checked={switches.off}
            onChange={(off) => {
              setSwitches((current) => ({ ...current, off }));
            }}
            label={t.switches.off}
          />
          <Switch checked={false} onChange={() => undefined} label={t.switches.disabled} disabled />
        </div>
      </Section>

      <Section id="ui-spinner" title={t.sections.spinner}>
        <div className="flex items-center gap-4">
          <Spinner size="sm" className="text-primary" />
          <Spinner className="text-ink" />
          <span className="flex size-11 items-center justify-center rounded-full bg-ink text-amber">
            <Spinner />
          </span>
        </div>
      </Section>

      <Section id="ui-skeleton" title={t.sections.skeleton}>
        <SkeletonGroup label={t.skeleton.dishCard}>
          <Card padding="none" radius="lg">
            <Skeleton height={150} />
            <div className="flex flex-col gap-2.5 p-4">
              <Skeleton shape="text" width="30%" className="text-sm" />
              <Skeleton shape="text" width="70%" className="text-3xl" />
              <div className="flex gap-2">
                <Skeleton shape="text" width={64} height={28} />
                <Skeleton shape="text" width={96} height={28} />
              </div>
            </div>
          </Card>
        </SkeletonGroup>
        <div className="flex items-center gap-3">
          <Skeleton shape="circle" width={40} />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton shape="text" width="50%" />
            <Skeleton shape="text" width="30%" className="text-xs" />
          </div>
        </div>
        <Card tone="inverse" className="flex flex-col gap-2.5">
          <Skeleton tone="dark" height={64} />
          <Skeleton tone="dark" shape="text" width="70%" className="text-6xl" />
          <Skeleton tone="dark" shape="text" width="50%" />
        </Card>
      </Section>

      <Section id="ui-error" title={t.sections.errorState}>
        <Card>
          <ErrorState
            description={ru.common.errorHint}
            onRetry={() => {
              setRetries((count) => count + 1);
            }}
          />
          <p aria-live="polite" className="text-center text-xs text-muted">
            {retries > 0 ? t.errorState.retried(retries) : ''}
          </p>
        </Card>
        <Card tone="inverse">
          <ErrorState
            tone="dark"
            description={ru.common.errorHint}
            onRetry={() => {
              setRetries((count) => count + 1);
            }}
          />
        </Card>
      </Section>
    </main>
  );
}
