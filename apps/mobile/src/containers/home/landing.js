import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const { width, height } = Dimensions.get('window');

const Landing = ({ navigation, route }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
                {/* Logo/Icon Section */}
                <View style={{ marginBottom: 40, alignItems: 'center' }}>
                    <View style={{
                        width: 120,
                        height: 120,
                        borderRadius: 60,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 30
                    }}>
                        <Lucide name="sofa" color={colors.textInverse} size={60} />
                    </View>
                </View>

                {/* Welcome Text Section */}
                <View style={{ alignItems: 'center', marginBottom: 50 }}>
                    <AppText
                        label="Welcome to Shopynn"
                        variant={1}
                        fontSize={32}
                        color={colors.textInverse}
                        style={{ textAlign: 'center', marginBottom: 15 }}
                    />
                    <AppText
                        label="Manage your inventory with ease"
                        variant={2}
                        fontSize={16}
                        color={colors.textInverse}
                        style={{ textAlign: 'center', lineHeight: 24, opacity: 0.9 }}
                    />
                </View>

                {/* Features Section */}
                <View style={{ width: '100%', marginBottom: 50 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 15
                        }}>
                            <Lucide name="package" color={colors.textInverse} size={20} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText label="Track Products" variant={1} fontSize={16} color={colors.textInverse} />
                            <AppText label="Monitor your inventory in real-time" variant={2} fontSize={13} color={colors.textInverse} style={{ opacity: 0.8 }} />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 15
                        }}>
                            <Lucide name="trending-up" color={colors.textInverse} size={20} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText label="Sales Analytics" variant={1} fontSize={16} color={colors.textInverse} />
                            <AppText label="Get insights into your business" variant={2} fontSize={13} color={colors.textInverse} style={{ opacity: 0.8 }} />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 15
                        }}>
                            <Lucide name="shield-check" color={colors.textInverse} size={20} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText label="Secure & Reliable" variant={1} fontSize={16} color={colors.textInverse} />
                            <AppText label="Your data is safe with us" variant={2} fontSize={13} color={colors.textInverse} style={{ opacity: 0.8 }} />
                        </View>
                    </View>
                </View>

                {/* CTA Button */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate("Home")}
                    style={{
                        width: '100%',
                        height: 55,
                        backgroundColor: colors.surface,
                        borderRadius: 30,
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexDirection: 'row',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8
                    }}
                >
                    <AppText label="Get Started" variant={1} fontSize={18} color={config.THEME_COLOR} style={{ marginRight: 10 }} />
                    <Lucide name="arrow-right" color={config.THEME_COLOR} size={20} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}

export default Landing;