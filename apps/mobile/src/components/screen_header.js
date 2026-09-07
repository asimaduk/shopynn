import React, { useState, useEffect } from 'react';
import { Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import useTheme from '../hooks/useTheme';

const ScreenHeader = ({ children, onPress, label, hideBack }) => {
    const { colors } = useTheme();

    const titleStyle = { flex: 1, fontFamily: 'FiraSans-SemiBold', fontSize: 16, color: colors.text };

    return (
        <View style={{backgroundColor:colors.surface,flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:5}}>
            {hideBack ? (
                <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center', padding: 10 }}>
                    <Text style={titleStyle} numberOfLines={1}>{label}</Text>
                </View>
            ) : (
                <TouchableOpacity
                    activeOpacity={.6}
                    onPress={onPress}
                    style={{flexDirection:'row',flex:1,alignItems:'center',padding:10}}>
                    <Lucide name="move-left" color={colors.text} size={25} />
                    <Text style={{...titleStyle, marginLeft:10}} numberOfLines={1}>{label}</Text>
                </TouchableOpacity>
            )}
            {children}
        </View>
    )
}

export default ScreenHeader;