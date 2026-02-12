import styles from './StatCard.module.css';
import { DashboardStat } from '@smartgym/types';
import { formatNumber } from '@smartgym/utils';

export function StatCard({ title, value, change, trend }: DashboardStat) {
    const displayValue = typeof value === 'number' ? formatNumber(value) : value;

    const showTrend = change !== undefined && trend !== undefined;
    const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
    const trendClass = trend === 'up' ? styles.trendUp : trend === 'down' ? styles.trendDown : styles.trendNeutral;

    return (
        <div className={styles.card}>
            <p className={styles.title}>{title}</p>
            <div className={styles.valueContainer}>
                <p className={styles.value}>{displayValue}</p>
                {showTrend && (
                    <span className={`${styles.trend} ${trendClass}`}>
                        {trendIcon} {change > 0 ? '+' : ''}{change}%
                    </span>
                )}
            </div>
        </div>
    );
}
