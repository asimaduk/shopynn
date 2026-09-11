import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import styles from './styles';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { suppliers as suppliersApi } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const SupplierDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item: paramItem, supplierId } = route.params || {};
    const [item, setItem] = useState(paramItem || {});
    const [loading, setLoading] = useState(!!(supplierId || paramItem?.id));

    useFocusEffect(
        React.useCallback(() => {
            const id = supplierId || paramItem?.id;
            if (!id) {
                return;
            }
            let mounted = true;
            setLoading(true);
            suppliersApi
                .get(id)
                .then((data) => {
                    if (mounted && data) {
                        setItem((prev) => ({ ...prev, ...data }));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    if (mounted) setLoading(false);
                });
            return () => {
                mounted = false;
            };
        }, [supplierId, paramItem?.id]),
    );

    const backPress = () => {
        navigation.goBack();
    };

    const handleCallSupplier = async () => {
        const phone = String(item.phone || '').trim();
        if (!phone) return;
        const url = `tel:${phone}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Call', 'This device cannot make phone calls.');
            }
        } catch (err) {
            const msg = err?.message || 'Failed to start the call.';
            Alert.alert('Error', msg);
        }
    };

    const LinkItem = ({ label, icon, onPress, color }) => (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                padding: 15,
                borderRadius: 8,
                marginBottom: 10,
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 1
            }}
        >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color + '15', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                <Lucide name={icon} size={20} color={color} />
            </View>
            <AppText label={label} fontSize={16} fontFamily="FiraSans-Medium" color={colors.text} style={{ flex: 1 }} />
            <Lucide name="chevron-right" size={20} color={colors.border} />
        </TouchableOpacity>
    );

    const DetailRow = ({ label, value, icon }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <View style={{ width: 30, alignItems: 'center' }}>
                <Lucide name={icon} size={16} color={colors.textTertiary} />
            </View>
            <View style={{ marginLeft: 10 }}>
                <AppText label={label} fontSize={12} color={colors.placeholder} />
                <AppText label={value} fontSize={15} color={colors.text} />
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading supplier..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    if (!item?.name && !item?.id) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="Supplier Details" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <AppText label="Supplier not found" fontSize={15} color={colors.textSecondary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="Supplier Details">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('SupplierForm', { item })}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.surface,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 15,
                        elevation: 2,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        marginBottom: 5
                    }}>
                    <Lucide name="pencil" color={config.THEME_COLOR} size={20} />
                </TouchableOpacity>
            </ScreenHeader>
            <ScrollView contentContainerStyle={{ padding: 20 }}>

                <View style={{ alignItems: 'center', marginBottom: 30 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', marginBottom: 10, overflow: 'hidden' }}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <Lucide name="truck" size={40} color={colors.textTertiary} />
                        )}
                    </View>
                    <AppText label={item.name} fontSize={22} fontFamily="FiraSans-Bold" color={colors.text} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: config.GREEN_COLOR, marginRight: 5 }} />
                        <AppText label="Verified Supplier" fontSize={14} color={config.GREEN_COLOR} />
                    </View>
                </View>

                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                    <DetailRow label="Location" value={item.address ?? 'N/A'} icon="map-pin" />
                    <DetailRow label="Phone Number" value={item.phone} icon="phone" />
                    <DetailRow label="Contact Person" value={item.manager ?? 'N/A'} icon="user" />
                    {/* <DetailRow label="Email Address" value={item.email} icon="mail" /> */}
                    {item.phone ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleCallSupplier}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                    backgroundColor: config.THEME_COLOR + '15',
                                }}
                            >
                                <Lucide name="phone" size={16} color={config.THEME_COLOR} style={{ marginRight: 6 }} />
                                <AppText label="Call supplier" fontSize={13} color={config.THEME_COLOR} />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>

                <AppText label="Quick Links" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 10, marginLeft: 5 }} />

                <LinkItem
                    label="Recent Supplies"
                    icon="package-check"
                    color="#9c27b0"
                    onPress={() => navigation.navigate('SupplierSupplies', { supplierId: item.id, supplierName: item.name })}
                />

                {/* <LinkItem
                    label="Purchase History"
                    icon="history"
                    color="#009688"
                    onPress={() => { }}
                />

                <LinkItem
                    label="Contact Supplier"
                    icon="message-circle"
                    color="#e91e63"
                    onPress={() => { }}
                /> */}

            </ScrollView>
        </SafeAreaView>
    );
};

export default SupplierDetails;
