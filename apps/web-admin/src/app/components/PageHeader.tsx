import { CSSProperties } from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
}

const titleStyle: CSSProperties = {
    fontSize: 'var(--text-xl)' as unknown as number,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    marginBottom: 4,
};

const descriptionStyle: CSSProperties = {
    fontSize: 'var(--text-base)' as unknown as number,
    color: 'var(--color-text-secondary)',
    margin: 0,
};

export function PageHeader({ title, description }: PageHeaderProps) {
    return (
        <div>
            <h1 style={titleStyle}>{title}</h1>
            {description && <p style={descriptionStyle}>{description}</p>}
        </div>
    );
}
