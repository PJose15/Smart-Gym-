import { CSSProperties } from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
}

const titleStyle: CSSProperties = {
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
    marginBottom: 4,
};

const descriptionStyle: CSSProperties = {
    fontSize: 14,
    color: '#666',
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
