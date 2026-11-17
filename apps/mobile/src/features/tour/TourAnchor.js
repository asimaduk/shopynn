import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { registerTourAnchor, unregisterTourAnchor } from './tourAnchors';

/**
 * Registers a measurable region for product tours.
 * Wrap interactive targets (or place as sibling) with a stable `id`.
 */
export default function TourAnchor({ id, children, style, ...rest }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!id) return undefined;
        registerTourAnchor(id, ref);
        return () => unregisterTourAnchor(id, ref);
    }, [id]);

    return (
        <View
            ref={ref}
            collapsable={false}
            testID={id}
            nativeID={id}
            style={style}
            {...rest}
        >
            {children}
        </View>
    );
}
