import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const ZigzagBottomBorder = ({ children, containerStyle, zigzagColor = '#FFF', backgroundColor = '#DEDEDE', height = 10, jagWidth = 20 }) => {
    const [width, setWidth] = useState(Dimensions.get('window').width);

    // Function to generate the SVG path 'd' attribute for the zigzag
    const generateZigzagPath = (w, h, jw) => {
        // Start at bottom-left
        let path = `M0,0 L0,${h} `;
        for (let i = 0; i < w; i += jw) {
            // Alternate between moving up and down by height 'h'
            const y = i % (jw * 2) === 0 ? h : 0;
            path += `L${i},${y} `;
        }
        // End at bottom-right
        path += `L${w},${h} L${w},0 Z`;
        return path;
    };

    const svgPath = generateZigzagPath(width, height, jagWidth);

    return (
        <View
            style={[styles.container, { backgroundColor }, containerStyle]}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {children}
            <View style={styles.svgContainer}>
                <Svg height={height} width={width} viewBox={`0 0 ${width} ${height}`}>
                    <Path
                        d={svgPath}
                        fill={backgroundColor} // Fill the jags with the container background color
                        stroke={zigzagColor} // Color of the zigzag border line itself
                        strokeWidth={1}
                    />
                </Svg>
            </View>
        </View>
    );
};

export default ZigzagBottomBorder;

const styles = StyleSheet.create({
    container: {
        paddingBottom: 10, // Add padding to prevent content from overlapping the zigzag
        overflow: 'hidden', // Ensures the SVG is contained within the bounds
    },
    svgContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    }
});
