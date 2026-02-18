import { CSSProperties } from 'react';

interface StatCardProps {
    title: string;
    value: number;
    change?: number;
    trend?: 'up' | 'down' | 'neutral';
}

const cardStyle: CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
};

const titleStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    margin: 0,
};

const valueStyle: CSSProperties = {
    fontSize: 32,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
    lineHeight: 1,
};

function getTrendStyle(trend?: 'up' | 'down' | 'neutral'): CSSProperties {
    if (trend === 'up') return { color: '#2e7d32', fontSize: 13, fontWeight: 600 };
    if (trend === 'down') return { color: '#c62828', fontSize: 13, fontWeight: 600 };
    return { color: '#888', fontSize: 13, fontWeight: 600 };
}

function getTrendArrow(trend?: 'up' | 'down' | 'neutral'): string {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
}

export function StatCard({ title, value, change, trend }: StatCardProps) {
    return (
        <div style={cardStyle}>
            <p style={titleStyle}>{title}</p>
            <p style={valueStyle}>{value.toLocaleString()}</p>
            {change !== undefined && (
                <span style={getTrendStyle(trend)}>
                    {getTrendArrow(trend)} {Math.abs(change)}% vs last period
                </span>
            )}
        </div>
    );
}
