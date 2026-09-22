import React, { useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Linking,
    Alert,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { suppliers as suppliersApi } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const supplierInitials = (name) => {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return 'S';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const SupplierDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item: paramItem, supplierId } = route.params || {};
    const [item, setItem] = useState(paramItem || {});
    const [loading, setLoading] = useState(!!(supplierId || paramItem?.id));

    useFocusEffect(
        React.useCallback(() => {
            const id = supplierId || paramItem?.id;
            if (!id) return undefined;
            let mounted = true;
            setLoading(true);
            suppliersApi
                .get(id)
                .then((data) => {
                    if (mounted && data) setItem((prev) => ({ ...prev, ...data }));
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

    const backPress = () => navigation.goBack();

    const handleCallSupplier = async () => {
        const phone = String(item.phone || '').trim();
        if (!phone) return;
        const url = `tel:${phone}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) await Linking.openURL(url);
            else Alert.alert('Call', 'This device cannot make phone calls.');
        } catch (err) {
            Alert.alert('Error', err?.message || 'Failed to start the call.');
        }
    };

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="Supplier Details" />
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading supplier..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            </SafeAreaView>
        );
    }

    if (!item?.name && !item?.id) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="Supplier Details" />
                <View style={styles.centered}>
                    <AppText label="Supplier not found" fontSize={15} color={colors.textSecondary} />
                </View>
            </SafeAreaView>
        );
    }

    const name = item.name || item.company_name || 'Unnamed supplier';
    const details = [
        { label: 'Location', value: item.address || item.location || '—', icon: 'map-pin' },
        { label: 'Phone', value: item.phone || '—', icon: 'phone' },
        { label: 'Contact person', value: item.manager || item.contact_person || '—', icon: 'user' },
        ...(item.email ? [{ label: 'Email', value: item.email, icon: 'mail' }] : []),
    ];

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="Supplier Details">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('SupplierForm', { item })}
                    style={[styles.headerBtn, { backgroundColor: colors.surface }]}
                >
                    <Lucide name="pencil" color={config.THEME_COLOR} size={18} />
                </TouchableOpacity>
            </ScreenHeader>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={[styles.avatar, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.avatarImage} />
                        ) : (
                            <AppText label={supplierInitials(name)} variant={1} fontSize={28} color={config.THEME_COLOR} />
                        )}
                    </View>
                    <AppText label={name} variant={1} fontSize={22} color={colors.text} style={{ textAlign: 'center' }} />
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: config.GREEN_COLOR || '#16a34a' }]} />
                        <AppText label="Active supplier" fontSize={13} color={config.GREEN_COLOR || '#16a34a'} />
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {details.map((row, index) => (
                        <View
                            key={row.label}
                            style={[
                                styles.detailRow,
                                index < details.length - 1 && {
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                    borderBottomColor: colors.border,
                                },
                            ]}
                        >
                            <View style={[styles.detailIcon, { backgroundColor: colors.surfaceSecondary || colors.background }]}>
                                <Lucide name={row.icon} size={16} color={colors.textTertiary} />
                            </View>
                            <View style={styles.detailText}>
                                <AppText label={row.label} fontSize={12} color={colors.textTertiary} />
                                <AppText label={row.value} fontSize={15} color={colors.text} style={{ marginTop: 3 }} />
                            </View>
                        </View>
                    ))}

                    {item.phone ? (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleCallSupplier}
                            style={[styles.callBtn, { backgroundColor: `${config.THEME_COLOR}14` }]}
                        >
                            <Lucide name="phone" size={16} color={config.THEME_COLOR} />
                            <AppText label="Call supplier" fontSize={14} variant={1} color={config.THEME_COLOR} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    ) : null}
                </View>

                <AppText label="Quick links" fontSize={11} variant={1} color={colors.textTertiary} style={styles.sectionLabel} />
                <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() =>
                        navigation.navigate('SupplierSupplies', {
                            supplierId: item.id,
                            supplierName: name,
                        })
                    }
                    style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                    <View style={[styles.linkIcon, { backgroundColor: '#8b5cf618' }]}>
                        <Lucide name="package-check" size={18} color="#8b5cf6" />
                    </View>
                    <View style={styles.linkMain}>
                        <AppText label="Recent supplies" variant={1} fontSize={15} color={colors.text} />
                        <AppText label="Deliveries and stock from this supplier" fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                    </View>
                    <Lucide name="chevron-right" size={18} color={colors.border} />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBtn: {
        height: 34,
        width: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 36 },
    hero: { alignItems: 'center', marginBottom: 20 },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        overflow: 'hidden',
    },
    avatarImage: { width: 84, height: 84, borderRadius: 42 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    card: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        paddingTop: 4,
        paddingBottom: 14,
        marginBottom: 20,
    },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
    detailIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    detailText: { flex: 1, minWidth: 0 },
    callBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        paddingVertical: 12,
        borderRadius: 999,
    },
    sectionLabel: {
        marginBottom: 10,
        marginLeft: 4,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    linkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        marginBottom: 10,
    },
    linkIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    linkMain: { flex: 1, minWidth: 0 },
});

export default SupplierDetails;
