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
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: '22px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    cursor: 'default',
    border: '1px solid rgba(79, 195, 247, 0.08)',
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
