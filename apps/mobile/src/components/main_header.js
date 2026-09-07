import React, { useState, useEffect } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import useTheme from '../hooks/useTheme';
import AppText from './text';

const Header = ({ navigation, screen }) => {
    const user = useSelector(({ user }) => user);
    const { colors } = useTheme();

    const fullName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
    const initials = fullName
        ? fullName
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join('')
        : 'U';
    const profileImage = user?.profile_image || user?.profileImage;

    return (
        <View style={{flexDirection:'row',padding:10}}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Profile')}
                style={{marginRight: 8}}
            >
                {profileImage ? (
                    <Image
                        source={{ uri: profileImage }}
                        style={{ width: 45, height: 45, borderRadius: 45, backgroundColor: colors.border }}
                    />
                ) : (
                    <View
                        style={{
                            width: 45,
                            height: 45,
                            borderRadius: 45,
                            backgroundColor: colors.primaryShade || colors.surfaceSecondary || colors.border,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <AppText label={initials} variant={1} fontSize={16} color={colors.text} />
                    </View>
                )}
            </TouchableOpacity>
            <TouchableOpacity 
                activeOpacity={.6} 
                onPress={()=> navigation.navigate("Search", {source_nav: "inventory"})}
                style={{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:30,flex:1,marginHorizontal:10,paddingLeft:10,paddingVertical:10}}>
                <Lucide name="search" color={colors.textTertiary} size={17} />
                <Text style={{fontFamily:'FiraSans-SemiBold',fontSize:13,marginLeft:5,color:colors.textTertiary}}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity
                activeOpacity={.6}
                onPress={()=> navigation.navigate("Notifications")}
                style={{width:45,height:45,borderRadius:99,backgroundColor:colors.surface,justifyContent:'center',alignItems:'center'}}>
                <Lucide name="bell" color={colors.text} size={17} />
            </TouchableOpacity>
            {/* <TouchableOpacity
                style={{width:35,height:35,borderRadius:10,backgroundColor:'#fff',justifyContent:'center',alignItems:'center',marginLeft:10}}>
                <Lucide name="message-square-dot" color="#4d4d4d" size={17} />
            </TouchableOpacity> */}
        </View>
    )
}

export default Header;