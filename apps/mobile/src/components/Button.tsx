import { TouchableOpacity, Text as RNText, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'outline' | 'danger';
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
    const containerStyle = [
        styles.base,
        variant === 'outline' && styles.outline,
        variant === 'danger' && styles.danger,
        (disabled || loading) && styles.disabled,
        style,
    ];
    const textStyle: TextStyle = {
        fontSize: 16,
        fontWeight: '600',
        color: variant === 'outline' ? colors.primary : colors.white,
        textAlign: 'center',
    };

    return (
        <TouchableOpacity style={containerStyle} onPress={onPress} disabled={disabled || loading} activeOpacity={0.8}>
            {loading ? (
                <ActivityIndicator size="small" color={variant === 'outline' ? colors.primary : colors.white} />
            ) : (
                <RNText style={textStyle}>{title}</RNText>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.primary,
    },
    danger: {
        backgroundColor: colors.error,
    },
    disabled: {
        opacity: 0.5,
    },
});
