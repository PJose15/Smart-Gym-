'use client';

import { CSSProperties } from 'react';
import { AnimatedNumber } from './AnimatedNumber';

interface StatCardProps {
    title: string;
    value: number;
    change?: number;
    trend?: 'up' | 'down' | 'neutral';
    index?: number;
}

const cardStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-raised)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--card-padding-lg) var(--card-padding-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    cursor: 'default',
    border: '1px solid var(--color-border-subtle)',
};

const titleStyle: CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-medium)' as unknown as number,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-wider)',
    margin: 0,
    fontFamily: 'var(--font-sans)',
};

const valueStyle: CSSProperties = {
    fontSize: 'var(--text-3xl)',
    fontWeight: 'var(--weight-bold)' as unknown as number,
    color: 'var(--color-text-primary)',
    margin: 0,
    lineHeight: 'var(--leading-tight)' as unknown as number,
    letterSpacing: 'var(--tracking-tight)',
    fontFamily: 'var(--font-sans)',
};

function getTrendStyle(trend?: 'up' | 'down' | 'neutral'): CSSProperties {
    if (trend === 'up') return { color: 'var(--color-green-light)', fontSize: 'var(--text-sm)', fontWeight: 500 };
    if (trend === 'down') return { color: 'var(--color-red-light)', fontSize: 'var(--text-sm)', fontWeight: 500 };
    return { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', fontWeight: 500 };
}

function getTrendArrow(trend?: 'up' | 'down' | 'neutral'): string {
    if (trend === 'up') return '\u2191';
    if (trend === 'down') return '\u2193';
    return '\u2192';
}

export function StatCard({ title, value, change, trend, index = 0 }: StatCardProps) {
    return (
        <div
            style={cardStyle}
            className={`stat-card-animated stat-delay-${index}`}
        >
            <p style={titleStyle}>{title}</p>
            <p style={valueStyle}>
                <AnimatedNumber value={value} />
            </p>
            {change !== undefined && (
                <span style={getTrendStyle(trend)}>
                    {getTrendArrow(trend)} {Math.abs(change)}% vs last period
                </span>
            )}
        </div>
    );
}
