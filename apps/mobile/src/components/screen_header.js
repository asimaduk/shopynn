import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import useTheme from '../hooks/useTheme';

const ScreenHeader = ({ children, onPress, label, hideBack }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const titleStyle = { flex: 1, fontFamily: 'FiraSans-SemiBold', fontSize: 16, color: colors.text };

    return (
        <View
            style={{
                backgroundColor: colors.surface,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: insets.top,
                paddingBottom: 4,
            }}
        >
            {hideBack ? (
                <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={titleStyle} numberOfLines={1}>{label}</Text>
                </View>
            ) : (
                <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={onPress}
                    style={{ flexDirection: 'row', flex: 1, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 }}
                >
                    <Lucide name="move-left" color={colors.text} size={25} />
                    <Text style={{ ...titleStyle, marginLeft: 10 }} numberOfLines={1}>{label}</Text>
                </TouchableOpacity>
            )}
            {children}
        </View>
    );
};

export default ScreenHeader;
