import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text } from 'react-native-svg';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

/** Compact map-style banner for tour welcome / catalog (matches web TourMapGraphic). */
export default function TourMapGraphic({ compact = true, pinLabel = 'You are here' }) {
    const { colors, isDark } = useTheme();
    const brand = config.THEME_COLOR;
    const soft = colors.textTertiary || '#64748B';
    const card = isDark ? '#0F172A' : '#FFFFFF';
    const height = compact ? 112 : 148;
    const stops = compact
        ? [
              { x: 36, y: 64, label: 'Sales' },
              { x: 100, y: 36, label: 'Stock' },
              { x: 164, y: 64, label: 'People' },
              { x: 228, y: 36, label: 'Buy' },
              { x: 292, y: 64, label: 'More' },
          ]
        : [
              { x: 36, y: 96, label: 'Sales' },
              { x: 100, y: 56, label: 'Stock' },
              { x: 164, y: 96, label: 'People' },
              { x: 228, y: 56, label: 'Buy' },
              { x: 292, y: 96, label: 'More' },
          ];
    const path = compact
        ? 'M36 64 C 68 64, 84 36, 100 36 S 140 64, 164 64 S 204 36, 228 36 S 268 64, 292 64'
        : 'M36 96 C 68 96, 84 56, 100 56 S 140 96, 164 96 S 204 56, 228 56 S 268 96, 292 96';

    return (
        <View
            style={[
                styles.wrap,
                {
                    backgroundColor: `${brand}14`,
                    borderColor: `${brand}33`,
                },
            ]}
            pointerEvents="none"
        >
            <Svg width="100%" height={height} viewBox={`0 0 328 ${height}`}>
                <Path
                    d={path}
                    fill="none"
                    stroke={`${brand}99`}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray="6 8"
                />
                {stops.map((stop, i) => (
                    <G key={stop.label} transform={`translate(${stop.x} ${stop.y})`}>
                        <Circle r={14} fill={card} stroke={brand} strokeWidth={2.5} />
                        <Circle r={4.5} fill={i === 0 ? brand : soft} />
                        <Text
                            y={28}
                            textAnchor="middle"
                            fill={soft}
                            fontSize={10}
                            fontWeight="600"
                        >
                            {stop.label}
                        </Text>
                    </G>
                ))}
                <G transform={`translate(164 ${compact ? 14 : 22})`}>
                    <Rect x={-52} y={-14} width={104} height={28} rx={14} fill={brand} />
                    <Text y={5} textAnchor="middle" fill="#FFFFFF" fontSize={11} fontWeight="700">
                        {pinLabel}
                    </Text>
                </G>
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        marginBottom: 4,
        width: '100%',
    },
});
