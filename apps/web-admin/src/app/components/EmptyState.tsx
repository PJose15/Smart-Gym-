import styles from './EmptyState.module.css';

interface EmptyStateProps {
    message: string;
    icon?: string;
}

export function EmptyState({ message, icon = '📋' }: EmptyStateProps) {
    return (
        <div className={styles.container}>
            <div className={styles.icon}>{icon}</div>
            <p className={styles.message}>{message}</p>
        </div>
    );
}
