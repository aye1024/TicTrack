import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';
import { colors, severityColor, spacing, type } from '../theme';
import type { BodyRegion } from '../types';

/** Rounded areas. They meet at the edges and do not stack on each other. */
const ZONES: Record<BodyRegion, string> = {
  head: 'M 84.65 12 C 74 13 70 18 70 24 C 70 29 76 31 84.65 31 C 93.3 31 99.3 29 99.3 24 C 99.3 18 95.3 13 84.65 12 Z',
  eyes: 'M 73 33.5 C 73 30.5 81 30.5 81 33.5 C 81 36.5 73 36.5 73 33.5 Z M 88.3 33.5 C 88.3 30.5 96.3 30.5 96.3 33.5 C 96.3 36.5 88.3 36.5 88.3 33.5 Z',
  face: 'M 84.65 37.5 C 75 37.5 72 39.5 73 42 C 74 44 79 44.5 84.65 44.5 C 90.3 44.5 95.3 44 96.3 42 C 97.3 39.5 94.3 37.5 84.65 37.5 Z',
  mouth: 'M 84.65 45 C 78.5 45 76.5 46.8 76.5 48.2 C 76.5 50 79.5 51 84.65 51 C 89.8 51 92.8 50 92.8 48.2 C 92.8 46.8 90.8 45 84.65 45 Z',
  neck: 'M 84.65 54 C 76 55 73 59 74 64 C 75 69 80 71 84.65 71 C 89.3 71 94.3 69 95.3 64 C 96.3 59 93.3 55 84.65 54 Z',
  shoulders:
    'M 58 60 C 46 58 38 66 38 78 C 38 90 48 96 60 92 C 68 89 72 78 70 68 C 69 62 64 60 58 60 Z M 111.3 60 C 123.3 58 131.3 66 131.3 78 C 131.3 90 121.3 96 109.3 92 C 101.3 89 97.3 78 99.3 68 C 100.3 62 105.3 60 111.3 60 Z',
  arms: 'M 50 98 C 40 102 34 122 32 142 C 30 158 36 166 44 164 C 52 160 58 142 58 122 C 58 106 56 98 50 98 Z M 119.3 98 C 129.3 102 135.3 122 137.3 142 C 139.3 158 133.3 166 125.3 164 C 117.3 160 111.3 142 111.3 122 C 111.3 106 113.3 98 119.3 98 Z',
  hands:
    'M 42 168 C 30 166 20 172 19 182 C 18 192 24 200 34 199 C 44 198 48 188 46 178 C 45 170 44 168 42 168 Z M 127.3 168 C 139.3 166 149.3 172 150.3 182 C 151.3 192 145.3 200 135.3 199 C 125.3 198 121.3 188 123.3 178 C 124.3 170 125.3 168 127.3 168 Z',
  torso:
    'M 84.65 132 C 74 134 72 148 72 160 C 72 174 75 186 80 190 C 83 193 86.3 193 89.3 190 C 94.3 186 97.3 174 97.3 160 C 97.3 148 95.3 134 84.65 132 Z',
  legs: 'M 72 214 C 58 216 56 238 58 268 C 59 298 60 316 66 326 C 70 332 80 328 82 318 C 84 292 84 252 82 228 C 81 216 78 214 72 214 Z M 97.3 214 C 111.3 216 113.3 238 111.3 268 C 110.3 298 109.3 316 103.3 326 C 99.3 332 89.3 328 87.3 318 C 85.3 292 85.3 252 87.3 228 C 88.3 216 91.3 214 97.3 214 Z',
  voice: '',
};

const SILHOUETTE = `M 63.5 328.3 C 57.0 327.5 56.4 324.1 61.4 317.2 C 66.3 310.4 66.2 304.9 61.0 278.1 L 57.0 257.1 L 58.4 248.2 C 60.5 235.7 60.3 226.2 57.6 213.5 C 54.5 198.8 53.7 172.1 55.9 153.7 C 58.2 133.9 58.7 130.8 60.3 126.2 C 61.8 122.4 61.8 121.2 60.7 115.6 L 59.5 109.3 L 58.3 112.3 C 57.7 114.0 56.7 118.6 56.3 122.7 C 55.6 129.3 54.6 132.3 47.9 147.6 C 43.7 157.1 40.4 165.7 40.6 166.5 C 40.9 167.3 40.6 173.0 40.0 179.1 C 39.0 189.7 38.9 190.3 36.9 190.6 C 35.8 190.7 34.9 191.4 34.9 192.1 C 34.9 193.3 30.7 196.1 28.7 196.1 C 28.2 196.1 26.6 195.2 25.1 194.1 C 22.6 192.3 22.5 191.8 22.5 186.1 C 22.5 180.2 22.4 180.0 20.2 180.0 C 18.4 180.0 18.0 179.6 18.0 177.3 C 18.0 173.8 23.0 164.3 25.8 162.5 C 28.6 160.6 31.1 153.0 33.6 138.7 C 35.7 126.2 37.1 121.1 39.7 116.1 C 41.7 112.3 44.7 93.9 45.1 83.4 C 45.5 68.3 49.5 62.4 60.3 59.8 C 65.9 58.5 73.2 53.7 73.8 51.0 C 69.2 44 68.2 34 68.2 26 C 68.2 14 74.5 8 84.65 8 C 94.8 8 101.1 14 101.1 26 C 101.1 34 100.1 44 95.5 51 C 96.1 54.3 100.9 57.3 109.4 59.9 C 117.6 62.4 119.9 64.1 122.4 69.7 C 124.0 73.5 124.4 76.2 124.6 83.9 C 124.8 96.2 127.2 109.3 130.5 117.1 C 132.0 120.6 133.8 126.7 134.4 130.9 C 137.0 147.2 137.6 150.4 138.9 154.7 C 139.7 157.5 141.4 160.6 143.1 162.4 C 147.2 166.5 150.8 173.9 150.8 177.8 C 150.8 180.6 150.5 180.9 148.6 180.9 C 146.4 180.9 146.4 181.1 146.4 186.5 C 146.4 191.7 146.2 192.3 143.7 194.1 C 142.3 195.2 140.7 196.1 140.2 196.1 C 138.3 196.1 133.9 192.9 133.9 191.4 C 133.9 190.6 133.1 189.8 131.9 189.7 C 129.3 189.3 128.7 186.3 128.2 172.9 L 127.8 162.7 L 122.0 149.5 C 115.1 133.9 113.7 129.7 113.0 122.2 C 112.8 119.1 112.0 114.9 111.4 112.9 L 110.3 109.3 L 109.3 115.1 C 108.5 119.7 108.5 121.6 109.5 125.2 C 110.2 127.6 111.1 132.1 111.5 135.0 C 111.9 138.0 112.9 142.8 113.7 145.7 C 114.4 148.7 115.5 158.1 116.1 166.7 C 117.1 184.4 116.3 198.9 113.3 213.8 C 111.3 223.4 111.3 225.5 113.0 254.5 C 113.5 262.6 113.2 264.8 109.9 280.2 C 104.7 304.0 104.9 311.4 110.8 319.0 C 112.9 321.7 113.0 325.9 110.9 326.9 C 108.1 328.4 99.6 329.1 97.2 327.9 C 94.1 326.6 93.1 324.2 91.8 315.2 C 91.0 309.2 91.0 306.5 92.0 301.4 C 93.3 294.2 92.9 287.2 90.2 274.6 C 88.1 264.5 88.0 257.8 89.8 249.6 C 91.1 243.9 91.1 242.7 89.8 236.9 C 89.1 233.3 88.3 226.0 88.0 220.6 C 87.7 215.2 87.0 208.2 86.5 205.0 L 85.4 199.2 L 84.3 205.9 C 83.7 209.5 83.2 216.3 83.2 220.9 C 83.1 225.4 82.4 232.2 81.6 236.0 C 80.2 243.0 80.3 245.7 82.1 255.8 C 83.2 262.0 83.0 266.0 80.3 278.5 C 78.5 287.3 78.2 297.2 79.5 302.2 C 80.4 305.4 79.5 315.8 77.8 322.2 C 76.3 328.4 73.6 329.4 63.5 328.3 Z`;

export function BodyMap({
  severityByRegion,
  size = 200,
  showLegend = true,
}: {
  severityByRegion: Partial<Record<BodyRegion, number>>;
  size?: number;
  showLegend?: boolean;
}) {
  const clipId = React.useId().replace(/:/g, '');
  const zone = (region: BodyRegion, d: string) => {
    const value = severityByRegion[region];
    if (value == null) return null;
    return <Path d={d} fill={severityColor(Math.max(1, value))} />;
  };

  const voice = severityByRegion.voice;
  const voiceLevel = voice == null ? null : Math.max(1, voice);
  const voiceInk = voiceLevel == null ? colors.text : severityColor(voiceLevel);

  return (
    <View style={{ alignItems: 'center', gap: spacing(1.5) }}>
      <Svg width={size} height={size * 1.64} viewBox="0 0 208 340">
        <Defs>
          <ClipPath id={clipId}>
            <Path d={SILHOUETTE} />
          </ClipPath>
        </Defs>

        <Path d={SILHOUETTE} fill={colors.surfaceAlt} />

        <G clipPath={`url(#${clipId})`}>
          {zone('legs', ZONES.legs)}
          {zone('arms', ZONES.arms)}
          {zone('hands', ZONES.hands)}
          {zone('shoulders', ZONES.shoulders)}
          {zone('torso', ZONES.torso)}
          {zone('neck', ZONES.neck)}
          {zone('head', ZONES.head)}
          {zone('face', ZONES.face)}
          {zone('eyes', ZONES.eyes)}
          {zone('mouth', ZONES.mouth)}
        </G>

        <Path
          d={SILHOUETTE}
          fill="none"
          stroke={colors.text}
          strokeOpacity={0.55}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />

        <G>
          <Path
            d="M108 38 H116 L124 30 V58 L116 50 H108 Z"
            fill={voiceLevel == null ? colors.surfaceAlt : severityColor(voiceLevel)}
            stroke={colors.text}
            strokeOpacity={0.7}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Path
            d="M128 36 C136 40 136 48 128 52"
            fill="none"
            stroke={voiceInk}
            strokeOpacity={voiceLevel == null ? 0.45 : 1}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
          <Path
            d="M132 32 C144 37 144 51 132 56"
            fill="none"
            stroke={voiceInk}
            strokeOpacity={voiceLevel == null ? 0.45 : 1}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {showLegend && (
        <View style={s.legend}>
          {[1, 2, 3, 4, 5].map((level) => (
            <View key={level} style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: severityColor(level) }]} />
              <Text style={type.small}>{level}</Text>
            </View>
          ))}
          <Text style={[type.small, { marginLeft: spacing(0.5) }]}>Severity</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
