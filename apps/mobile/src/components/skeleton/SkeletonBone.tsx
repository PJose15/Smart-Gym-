import { DimensionValue, ViewStyle } from 'react-native';
import { Shimmer } from './Shimmer';

interface BoneProps {
  variant: 'line' | 'circle' | 'rect';
  width?: DimensionValue;
  height?: number;
  size?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBone({
  variant,
  width,
  height,
  size = 40,
  borderRadius,
  style,
}: BoneProps) {
  switch (variant) {
    case 'circle':
      return (
        <Shimmer
          width={size}
          height={size}
          borderRadius={size / 2}
          style={style}
        />
      );
    case 'rect':
      return (
        <Shimmer
          width={width ?? '100%'}
          height={height ?? 100}
          borderRadius={borderRadius ?? 12}
          style={style}
        />
      );
    case 'line':
    default:
      return (
        <Shimmer
          width={width ?? '100%'}
          height={height ?? 14}
          borderRadius={borderRadius ?? 7}
          style={style}
        />
      );
  }
}
