import { useRef } from 'react';
import { Animated, Platform, Pressable, Text as RNText, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';

const USE_NATIVE = Platform.OS !== 'web';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'outline' | 'danger';
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.88,
            tension: 150,
            friction: 5,
            useNativeDriver: USE_NATIVE,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            tension: 80,
            friction: 4,
            useNativeDriver: USE_NATIVE,
        }).start();
    };

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
        <Animated.View style={{
            transform: [{ scale }],
            borderRadius: 10,
        }}>
            <Pressable
                style={containerStyle}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityState={{ disabled: !!disabled, busy: !!loading }}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={variant === 'outline' ? colors.primary : colors.white} />
                ) : (
                    <RNText style={textStyle}>{title}</RNText>
                )}
            </Pressable>
        </Animated.View>
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
