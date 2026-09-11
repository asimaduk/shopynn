import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import styles from './styles';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { customers as customersApi } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const CustomerDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item: paramItem, customerId } = route.params || {};
    const [item, setItem] = useState(paramItem || {});
    const [loading, setLoading] = useState(!!(customerId || paramItem?.id));

    useFocusEffect(
        React.useCallback(() => {
            const id = customerId || paramItem?.id;
            if (!id) {
                return;
            }
            let mounted = true;
            setLoading(true);
            customersApi
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
        }, [customerId, paramItem?.id]),
    );

    const backPress = () => {
        navigation.goBack();
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

    const handleCall = async () => {
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

    const DetailRow = ({ label, value, icon }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <View style={{ width: 30, alignItems: 'center' }}>
                <Lucide name={icon} size={16} color={colors.textTertiary} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
                <AppText label={label} fontSize={12} color={colors.placeholder} />
                <AppText label={value} fontSize={15} color={colors.text} />
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading customer..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    if (!item?.name && !item?.id) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="Customer Details" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <AppText label="Customer not found" fontSize={15} color={colors.textSecondary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'Customer Details'}>
                {item.source !== 'account' ? (
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate('CustomerForm', { item })}
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
                ) : null}
            </ScreenHeader>
            <ScrollView contentContainerStyle={{ padding: 20 }}>

                <View style={{ alignItems: 'center', marginBottom: 30 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', marginBottom: 10, overflow: 'hidden' }}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <Lucide name="user" size={40} color={colors.textTertiary} />
                        )}
                    </View>
                    <AppText label={item.name} fontSize={22} fontFamily="FiraSans-Bold" color={colors.text} />
                    <AppText
                        label={item.source === 'account' ? 'App signup customer' : item.source === 'pos' ? 'POS / admin customer' : 'Customer'}
                        fontSize={12}
                        color={colors.textSecondary}
                        style={{ marginTop: 6 }}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.is_active ? config.GREEN_COLOR : colors.error, marginRight: 5 }} />
                        <AppText label={item.is_active ? "Active Customer" : "Inactive Customer"} fontSize={14} color={item.is_active ? config.GREEN_COLOR : colors.error} />
                    </View>
                </View>

                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                    <DetailRow
                        label="Record type"
                        value={
                            item.source === 'account'
                                ? 'App signup (linked user)'
                                : item.source === 'pos'
                                  ? 'POS / admin'
                                  : '—'
                        }
                        icon="tag"
                    />
                    <DetailRow label="Location" value={item.address ? item.address : 'N/A'} icon="map-pin" />
                    <DetailRow label="Phone Number" value={item.phone ? item.phone : 'N/A'} icon="phone" />
                    <DetailRow label="Email Address" value={item.email ? item.email : 'N/A'} icon="mail" />
                    <DetailRow label="Notes" value={item.notes ? item.notes : 'N/A'} icon="sticky-note" />
                    {item.phone ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleCall}
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
                                <AppText label="Call customer" fontSize={13} color={config.THEME_COLOR} />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>

                {item.source !== 'account' ? (
                    <>
                        <AppText label="Quick Links" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 10, marginLeft: 5 }} />

                        <LinkItem
                            label="Transactions"
                            icon="shopping-bag"
                            color="#f39c12"
                            onPress={() => navigation.navigate('CustomerSale', { customerId: item.id, customerName: item.name })}
                        />

                        <LinkItem
                            label="Payments & History"
                            icon="credit-card"
                            color="#27ae60"
                            onPress={() => navigation.navigate('CustomerPayments', { customerId: item.id, customerName: item.name })}
                        />
                    </>
                ) : (
                    <AppText
                        label="POS sales history applies to POS/admin customers. App customers place orders from their account."
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginLeft: 5, lineHeight: 20 }}
                    />
                )}

                {/* <LinkItem
                    label="Recent Transactions"
                    icon="receipt"
                    color="#3498db"
                    onPress={() => { }}
                /> */}

            </ScrollView>
        </SafeAreaView>
    );
};

export default CustomerDetails;
