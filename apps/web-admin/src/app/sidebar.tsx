'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './sidebar.module.css';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/machines', label: 'Machines' },
  { href: '/programs', label: 'Programs' },
  { href: '/members', label: 'Members' },
  { href: '/members/discomfort', label: 'Safety Alerts' },
  { href: '/copilot', label: 'Co-Pilot' },
  { href: '/assignments', label: 'Assignments' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/gamification/badges', label: 'Badges' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <h1 className={styles.logo}>
          Smart<span className={styles.logoAccent}>Gym</span>
        </h1>
        <p className={styles.subtitle}>
          Admin Panel
        </p>
      </div>
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${isActive ? styles.linkActive : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
