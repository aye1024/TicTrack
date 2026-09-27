import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { colors, spacing, type } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Severity over time — the falling line drawn on the whiteboard next to the
 * body figure. Area-filled so a downward trend reads instantly.
 *
 * The line draws itself in on mount, left to right, with the fill and then the
 * points following it. A chart that is simply there does not invite reading; one
 * that is drawn in front of you says a measurement was taken, and the direction
 * of travel registers before any number does.
 *
 * The stroke is animated the usual way — dash the path to its own length and
 * pull the offset back to zero — which needs the exact length. It is computed
 * rather than measured, since the path is a polyline and summing its segments is
 * both cheap and exact. `useNativeDriver` is off throughout: these are SVG
 * attributes, and the native driver only handles transform and opacity.
 */
export function TrendChart({
  series,
  height = 150,
  width = 300,
  color = colors.primary,
  scoreAxis = false,
}: {
  series: { date: string; value: number }[];
  height?: number;
  width?: number;
  color?: string;
  /** Draw a Severity Score axis labeled 1–5. */
  scoreAxis?: boolean;
}) {
  const scoreColW = scoreAxis ? 16 : 0;
  const svgWidth = width - scoreColW;
  const padding = scoreAxis
    ? { top: 14, right: 8, bottom: 22, left: 26 }
    : { top: 12, right: 10, bottom: 22, left: 26 };
  const plotW = svgWidth - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const minY = 1;
  const maxY = 5;
  const ticks = [1, 2, 3, 4, 5];

  const x = (i: number) =>
    padding.left + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const y = (v: number) => {
    const clamped = Math.max(minY, Math.min(maxY, v));
    return padding.top + plotH - ((clamped - minY) / (maxY - minY)) * plotH;
  };

  const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${line} L${x(series.length - 1)},${padding.top + plotH} L${x(0)},${padding.top + plotH} Z`;

  // Exact length of the polyline, for the dash trick that reveals the stroke.
  const lineLength = useMemo(() => {
    let total = 0;
    for (let i = 1; i < series.length; i += 1) {
      total += Math.hypot(x(i) - x(i - 1), y(series[i].value) - y(series[i - 1].value));
    }
    // A single point has no length; 1 keeps the dash maths well-defined.
    return Math.max(1, total);
  }, [series, plotW, plotH, padding.left, padding.top]);

  const draw = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    draw.setValue(0);
    const animation = Animated.timing(draw, {
      toValue: 1,
      // Long enough to read as drawing, short enough not to delay the screen.
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [draw, lineLength, series.length]);

  const dashOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [lineLength, 0] });
  // The fill only makes sense once there is a line above it, so it trails.
  const areaOpacity = draw.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0, 1],
  });

  const label = (d: string) => d.slice(5).replace('-', '/');

  // Checked here, not at the top: every hook above has to run on every render,
  // and this component goes from empty to one point the moment a patient
  // completes their first check-in.
  if (series.length === 0) {
    return (
      <View style={[s.empty, { height }]}>
        <Text style={type.muted}>No check-ins yet. The line starts after your first one.</Text>
      </View>
    );
  }

  return (
    <View style={{ width }}>
      <View style={s.chartRow}>
      {scoreAxis && (
        <View style={[s.scoreCol, { height }]}>
          <Text style={s.scoreLabel}>Severity Score</Text>
        </View>
      )}
      <Svg width={svgWidth} height={height}>
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.24} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {ticks.map((v) => (
          <Line
            key={v}
            x1={padding.left}
            x2={svgWidth - padding.right}
            y1={y(v)}
            y2={y(v)}
            stroke={colors.border}
            strokeWidth={v === minY ? 1.2 : 0.7}
          />
        ))}

        {scoreAxis &&
          ticks.map((v) => (
            <SvgText
              key={`score-${v}`}
              x={padding.left - 6}
              y={y(v)}
              fill={colors.textMuted}
              fontSize={11}
              fontWeight="600"
              textAnchor="end"
              alignmentBaseline="middle"
            >
              {v}
            </SvgText>
          ))}

        {series.length > 1 && (
          <AnimatedPath d={area} fill="url(#fade)" opacity={areaOpacity} />
        )}
        <AnimatedPath
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={`${lineLength},${lineLength}`}
          strokeDashoffset={dashOffset}
        />
        {series.map((p, i) =>
          // Mark only the endpoints; a single observation gets one dot.
          i === 0 || i === series.length - 1 ? (
          <AnimatedCircle
            key={p.date}
            cx={x(i)}
            cy={y(p.value)}
            r={i === series.length - 1 ? 5 : 3}
            fill={colors.surface}
            stroke={color}
            strokeWidth={2.2}
            // Each point appears as the line reaches it, so the dots read as
            // being laid down by the stroke rather than arriving with it.
            opacity={pointOpacity(draw, i, series.length)}
          />
          ) : null,
        )}
      </Svg>
      </View>

      <View style={[s.axis, { paddingLeft: scoreColW + padding.left, paddingRight: padding.right }]}>
        <Text style={type.small}>{label(series[0].date)}</Text>
        {series.length > 1 && <Text style={type.small}>{label(series[series.length - 1].date)}</Text>}
      </View>
    </View>
  );
}

/**
 * Fades one point in over the moment the stroke passes it. The window is kept
 * wide enough that a long series does not flicker point by point, and the last
 * point is given the tail of the animation so the line lands on it.
 */
function pointOpacity(
  draw: Animated.Value,
  index: number,
  count: number,
): Animated.AnimatedInterpolation<number> {
  if (count <= 1) return draw.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const at = index / (count - 1);
  return draw.interpolate({
    inputRange: [0, Math.max(0.001, at * 0.92), Math.min(1, at * 0.92 + 0.12), 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });
}

const s = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
  },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing(1.5) },
  chartRow: { flexDirection: 'row' },
  scoreCol: { width: 16, alignItems: 'center', justifyContent: 'center' },
  scoreLabel: {
    width: 108,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    transform: [{ rotate: '-90deg' }],
  },
});
