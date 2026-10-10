import { useNavigate } from 'react-router';

import { IconDinner, IconFriends, IconMap } from '../components/icons.tsx';
import { TabBar, type TabBarItem } from '../components/TabBar.tsx';
import { ru } from '../i18n/ru.ts';
import { ROUTES } from './routes.ts';

const TABS: readonly TabBarItem[] = [
  { id: 'dinner', label: ru.tabs.dinner, href: ROUTES.home, icon: <IconDinner /> },
  { id: 'map', label: ru.tabs.map, href: ROUTES.map, icon: <IconMap /> },
  { id: 'friends', label: ru.tabs.friends, href: ROUTES.friends, icon: <IconFriends /> },
];

export type MainTab = 'dinner' | 'map' | 'friends';

/** The bottom bar of the tab screens (Ужин, Карта, Друзья), fixed at the bottom, router links. */
export function MainTabBar({ active }: { active: MainTab }) {
  const navigate = useNavigate();
  return (
    <TabBar
      items={TABS}
      activeId={active}
      label={ru.tabs.label}
      onNavigate={(item) => {
        void navigate(item.href);
      }}
      className="fixed inset-x-0 bottom-0 z-10"
    />
  );
}
