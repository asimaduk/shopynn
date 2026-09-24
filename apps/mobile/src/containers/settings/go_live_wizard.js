import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const STORAGE_KEY = 'shopynn:go_live_checklist_v1';

const STEPS = [
    {
        id: 'store',
        title: 'Confirm your store',
        description: 'Check shop name on Company profile.',
        screen: 'CompanyProfile',
        cta: 'Company profile',
    },
    {
        id: 'products',
        title: 'Add products & stock',
        description: 'Import CSV or add products with quantities.',
        screen: 'ProductImport',
        cta: 'Import products',
    },
    {
        id: 'receipt',
        title: 'Receipt preferences',
        description: 'Optional thermal printer — DIY is free.',
        screen: 'InvoiceReceiptSettings',
        cta: 'Receipt settings',
    },
    {
        id: 'first_sale',
        title: 'Make your first sale',
        description: 'Complete a cash sale on the till.',
        screen: 'NewSale',
        cta: 'New sale',
    },
];

const defaultDone = () => ({ store: false, products: false, receipt: false, first_sale: false });

const GoLiveWizard = ({ navigation }) => {
    const { colors } = useTheme();
    const [done, setDone] = useState(defaultDone());

    const load = useCallback(async () => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) setDone({ ...defaultDone(), ...JSON.parse(raw) });
            else setDone(defaultDone());
        } catch {
            setDone(defaultDone());
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const toggle = async (id) => {
        const next = { ...done, [id]: !done[id] };
        setDone(next);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const completedCount = STEPS.filter((s) => done[s.id]).length;

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Go live" />
            <ScrollView contentContainerStyle={styles.scroll}>
                <AppText
                    label="Four steps from empty shop to first sale — no agent required."
                    color={colors.textSecondary}
                    fontSize={14}
                    style={{ marginBottom: 8 }}
                />
                <AppText
                    label={`${completedCount} of ${STEPS.length} complete`}
                    variant={1}
                    fontSize={13}
                    color={config.THEME_COLOR}
                    style={{ marginBottom: 16 }}
                />
                {STEPS.map((step, index) => (
                    <View
                        key={step.id}
                        style={[
                            styles.card,
                            { backgroundColor: colors.surface, borderColor: colors.border || '#e2e8f0' },
                        ]}
                    >
                        <View style={styles.row}>
                            <View
                                style={[
                                    styles.badge,
                                    {
                                        backgroundColor: done[step.id]
                                            ? `${config.GREEN_COLOR || '#16a34a'}22`
                                            : `${config.THEME_COLOR}18`,
                                    },
                                ]}
                            >
                                {done[step.id] ? (
                                    <Lucide name="check" size={18} color={config.GREEN_COLOR || '#16a34a'} />
                                ) : (
                                    <AppText label={String(index + 1)} fontSize={14} color={config.THEME_COLOR} />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <AppText label={step.title} variant={2} fontSize={15} color={colors.text} />
                                <AppText
                                    label={step.description}
                                    fontSize={13}
                                    color={colors.textSecondary}
                                    style={{ marginTop: 4 }}
                                />
                                <View style={styles.actions}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => navigation.navigate(step.screen)}
                                        style={[styles.cta, { backgroundColor: config.THEME_COLOR }]}
                                    >
                                        <AppText label={step.cta} fontSize={13} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => toggle(step.id)}
                                        style={styles.mark}
                                    >
                                        <Lucide
                                            name={done[step.id] ? 'check-square' : 'square'}
                                            size={18}
                                            color={colors.textSecondary}
                                        />
                                        <AppText
                                            label="Mark done"
                                            fontSize={13}
                                            color={colors.textSecondary}
                                            style={{ marginLeft: 6 }}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 40 },
    card: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    row: { flexDirection: 'row', gap: 12 },
    badge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 12 },
    cta: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    mark: { flexDirection: 'row', alignItems: 'center' },
});

export default GoLiveWizard;
