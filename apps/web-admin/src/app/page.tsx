import styles from './page.module.css';
import { StatCard } from './components/StatCard';
import { DashboardStat } from '@smartgym/types';

const stats: DashboardStat[] = [
  { title: 'Total Machines', value: 1247, change: 12, trend: 'up' },
  { title: 'Active Programs', value: 23, change: -3, trend: 'down' },
  { title: 'Members', value: 1563, change: 8, trend: 'up' },
  { title: 'Sessions Today', value: 47, change: 15, trend: 'up' },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.description}>
        Overview of gym operations, usage statistics, and key metrics.
      </p>
      <div className={styles.grid}>
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
    </div>
  );
}
