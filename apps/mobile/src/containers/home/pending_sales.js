import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import styles from './styles';
import PendingSaleItem from './pending_sale_item';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { sales as salesApi } from '../../services/api';
import {
    SECURE_PENDING_SALES_KEY as PENDING_SALES_KEY,
    readSecureList,
    writeSecureList,
} from '../../utils/secureOfflineStorage';

const safeString = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const getErrorCode = (err) => safeString(err?.response?.data?.code || err?.response?.data?.error?.code || err?.response?.data?.data?.code).toUpperCase();
const getErrorMessage = (err) =>
    safeString(
        err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'Upload failed.'
    );

const PendingSales = ({ navigation }) => {
    const { colors } = useTheme();
    const [pendingSales, setPendingSales] = useState([]);
    const [loading, setLoading] = useState(false);

    const backPress = () => {
        navigation.goBack();
    }

    const loadPendingSales = useCallback(async () => {
        try {
            const list = await readSecureList(PENDING_SALES_KEY);
            setPendingSales(Array.isArray(list) ? list : []);
        } catch (e) {
            setPendingSales([]);
        }
    }, []);

    const retryPendingSales = useCallback(async () => {
        setLoading(true);
        try {
            const list = await readSecureList(PENDING_SALES_KEY);
            if (!Array.isArray(list) || list.length === 0) {
                setPendingSales([]);
                setLoading(false);
                return;
            }
            const stillPending = [];
            const nowIso = new Date().toISOString();
            for (const item of list) {
                try {
                    await salesApi.create(item.payload);
                } catch (err) {
                    stillPending.push({
                        ...item,
                        attempts: (Number(item?.attempts) || 0) + 1,
                        last_attempt_at: nowIso,
                        last_error_code: getErrorCode(err) || item?.last_error_code || null,
                        last_error_message: getErrorMessage(err) || item?.last_error_message || null,
                    });
                }
            }
            await writeSecureList(PENDING_SALES_KEY, stillPending);
            setPendingSales(stillPending);
            if (stillPending.length === 0) {
                Alert.alert('Pending sales', 'All pending sales have been uploaded successfully.');
            }
        } catch (e) {
            await loadPendingSales();
        } finally {
            setLoading(false);
        }
    }, [loadPendingSales]);

    useFocusEffect(
        useCallback(() => {
            loadPendingSales().then(() => {
                retryPendingSales();
            });
        }, [loadPendingSales, retryPendingSales]),
    );

    const formatter = new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: 'GHS',
    });

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'Pending Sales Upload'}>
                <View style={styles.headerActions}>
                    {pendingSales.length > 0 && (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            disabled={loading}
                            onPress={retryPendingSales}
                            style={[styles.actionButton, { backgroundColor: colors.surface, opacity: loading ? 0.6 : 1 }]}>
                            <Lucide name="square-arrow-out-up-right" color={colors.textSecondary} size={20} />
                        </TouchableOpacity>
                    )}
                </View>
            </ScreenHeader>
            {loading && pendingSales.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Uploading pending sales..." color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            ) : (
                <FlashList
                    contentContainerStyle={styles.listContent}
                    data={pendingSales}
                    estimatedItemSize={80}
                    showsVerticalScrollIndicator={false}
                    keyExtractor={(item, index) => item.id || index.toString()}
                    renderItem={({ item, index }) => (
                        <PendingSaleItem
                            item={item}
                            index={index}
                            formatter={formatter}
                            onPress={() => navigation.navigate("SaleDetails", { mode: "pending-upload", item })}
                        />
                    )}
                    ListEmptyComponent={() => (
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <View
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 28,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: colors.surfaceSecondary,
                                }}>
                                <Lucide name="cloud-check" size={26} color={config.THEME_COLOR} />
                            </View>
                            <AppText label="All sales synced" variant={1} color={colors.text} style={{ marginTop: 14 }} />
                            <AppText
                                label="There are no pending sales waiting for upload."
                                fontSize={12}
                                color={colors.textTertiary}
                                style={{ marginTop: 4, textAlign: 'center' }}
                            />
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    )
}

export default PendingSales;