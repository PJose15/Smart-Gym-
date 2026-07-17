import { Text as RNText, TextStyle, StyleProp } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type TextVariant = 'heading' | 'subheading' | 'body' | 'caption' | 'label';
type TextColor = 'default' | 'textSecondary' | 'error' | 'white' | 'primary';

interface TextProps {
    children: React.ReactNode;
    variant?: TextVariant;
    color?: TextColor;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
}

// fontFamily carries the weight for the loaded Inter static fonts
// (do not combine with fontWeight — Android would synthesize/override).
const variantStyles: Record<TextVariant, TextStyle> = {
    heading: { fontSize: 24, fontFamily: typography.fontBold, color: colors.text },
    subheading: { fontSize: 18, fontFamily: typography.fontSemiBold, color: colors.text },
    body: { fontSize: 15, fontFamily: typography.fontRegular, color: colors.text },
    caption: { fontSize: 13, fontFamily: typography.fontRegular, color: colors.textSecondary },
    label: { fontSize: 13, fontFamily: typography.fontSemiBold, color: colors.text },
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
