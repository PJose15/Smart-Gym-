import { Text as RNText, TextStyle, StyleProp } from 'react-native';
import { colors } from '../theme/colors';

type TextVariant = 'heading' | 'subheading' | 'body' | 'caption' | 'label';
type TextColor = 'default' | 'textSecondary' | 'error' | 'white' | 'primary';

interface TextProps {
    children: React.ReactNode;
    variant?: TextVariant;
    color?: TextColor;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
}

const variantStyles: Record<TextVariant, TextStyle> = {
    heading: { fontSize: 24, fontWeight: '700', color: colors.dark },
    subheading: { fontSize: 18, fontWeight: '600', color: colors.dark },
    body: { fontSize: 15, fontWeight: '400', color: colors.text },
    caption: { fontSize: 13, fontWeight: '400', color: colors.textSecondary },
    label: { fontSize: 13, fontWeight: '600', color: colors.text },
};

const colorMap: Record<TextColor, string> = {
    default: colors.text,
    textSecondary: colors.textSecondary,
    error: colors.error,
    white: colors.white,
    primary: colors.primary,
};

export function Text({ children, variant = 'body', color, style, numberOfLines }: TextProps) {
    const resolvedStyle: StyleProp<TextStyle> = [
        variantStyles[variant],
        color ? { color: colorMap[color] } : undefined,
        style,
    ];

    return (
        <RNText style={resolvedStyle} numberOfLines={numberOfLines}>
            {children}
        </RNText>
    );
}
