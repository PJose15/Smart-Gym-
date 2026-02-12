import { Text as RNText, TextStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface TextProps {
    children: React.ReactNode;
    variant?: 'heading' | 'subheading' | 'body' | 'caption';
    color?: keyof typeof colors;
    style?: TextStyle;
}

export function Text({ children, variant = 'body', color, style }: TextProps) {
    const textStyle = [
        variant === 'heading' && {
            fontSize: typography.fontSize.xxl,
            fontWeight: typography.fontWeight.bold,
            color: colors.text,
        },
        variant === 'subheading' && {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text,
        },
        variant === 'body' && {
            fontSize: typography.fontSize.md,
            fontWeight: typography.fontWeight.regular,
            color: colors.text,
        },
        variant === 'caption' && {
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.regular,
            color: colors.textSecondary,
        },
        color && { color: colors[color] },
        style,
    ];

    return <RNText style={textStyle}>{children}</RNText>;
}
