import type { ReactNode, SVGProps } from 'react';

/**
 * Stroke icons from the mockup. Decorative by default (`aria-hidden`): the control that holds an
 * icon gets the accessible name (a visible label or `aria-label`).
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function Icon({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconDinner(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </Icon>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </Icon>
  );
}

export function IconFriends(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />
    </Icon>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </Icon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      <path d="M5 12l5 5 9-10" />
    </Icon>
  );
}

export function IconBack(props: IconProps) {
  return (
    <Icon strokeWidth={2.2} {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Icon>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Icon strokeWidth={2.2} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function IconCart(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h2l2 11h10l2-8H7" />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </Icon>
  );
}

/** «Отправить»: an arrow up out of a tray (the shopping list's «Отправить список в чат»). */
export function IconShare(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />
    </Icon>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Icon strokeWidth={2.2} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </Icon>
  );
}

/** Onboarding: «Я один». */
export function IconPerson(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </Icon>
  );
}

/** Onboarding: «Мы вдвоём». */
export function IconCouple(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="3.5" />
      <circle cx="16" cy="8" r="3.5" />
      <path d="M2 20c0-3 3-5 6-5M22 20c0-3-3-5-6-5M8 15c1.2-.6 2.6-1 4-1s2.8.4 4 1" />
    </Icon>
  );
}

/** Onboarding: «Семья с детьми». */
export function IconFamily(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="7" r="3" />
      <circle cx="12" cy="14" r="2.5" />
      <path d="M2 20c0-3 2-5 5-5M22 20c0-3-2-5-5-5M8.5 21c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5" />
    </Icon>
  );
}

/** Onboarding: weekday dinner time. */
export function IconClock(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

/** A locked dish (new country without a subscription). */
export function IconLock(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

/** Photo of the cooked dish: camera. */
export function IconCamera(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </Icon>
  );
}

/** A round passport stamp: the feed entry of a friend who cooked without a photo. */
export function IconStamp(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" strokeDasharray="2 2" />
      <path d="M10 12l1.5 1.5L14.5 10.5" />
    </Icon>
  );
}
