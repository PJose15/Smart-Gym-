import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { TrendDataPoint } from '@nexera/utils';
import { colors } from '../theme/colors';

interface MiniChartProps {
  data: TrendDataPoint[];
  label: string;
  unit?: string;
  color?: string;
  height?: number;
  maxPoints?: number;
}

const CHART_WIDTH = Dimensions.get('window').width - 80; // card padding

export function MiniChart({
  data,
  label,
  unit = '',
  color = colors.primary,
  height = 160,
  maxPoints = 10,
}: MiniChartProps) {
  if (data.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Need at least 2 sessions to show {label.toLowerCase()} trend
        </Text>
      </View>
    );
  }

  const sliced = data.slice(-maxPoints);

  const labels = sliced.map((d) => {
    const parts = d.date.split('-');
    return `${parts[1]}/${parts[2]}`; // MM/DD
  });

  const values = sliced.map((d) => d.value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <LineChart
        data={{
          labels,
          datasets: [{ data: values }],
        }}
        width={CHART_WIDTH}
        height={height}
        yAxisSuffix={unit}
        withInnerLines={false}
        withOuterLines={false}
        withDots
        withShadow={false}
        fromZero={false}
        chartConfig={{
          backgroundColor: colors.surface,
          backgroundGradientFrom: colors.surface,
          backgroundGradientTo: colors.surface,
          decimalPlaces: 0,
          color: () => color,
          labelColor: () => colors.textSecondary,
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: color,
            fill: colors.surface,
          },
          propsForLabels: {
            fontSize: 10,
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chart: {
    borderRadius: 8,
    marginLeft: -16, // offset chart's internal padding
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
