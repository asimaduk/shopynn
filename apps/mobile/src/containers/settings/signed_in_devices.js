import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useFocusEffect } from '@react-navigation/native';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import ConfirmDialog from '../../components/ConfirmDialog';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { users as usersApi } from '../../services/api';
import AppAlert from '../../utils/appAlert';

const describeBrowser = (ua) => {
    const s = String(ua || '');
    const browser = /Edg\//.test(s) ? 'Edge' : /Chrome\//.test(s) ? 'Chrome' : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : '';
    const os = /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'Mac' : /Android/.test(s) ? 'Android' : /iPhone|iPad/.test(s) ? 'iOS' : /Linux/.test(s) ? 'Linux' : '';
    return [browser, os].filter(Boolean).join(' on ') || 'Unknown device';
};

const sessionTitle = (s) =>
    s.device_name || (s.platform === 'web' || !s.platform ? describeBrowser(s.user_agent) : `${s.platform} device`);

// Web sign-ins reach the API through the dashboard server, so their IP isn't the user's.
const sessionIp = (s) => (s.platform === 'web' ? '' : s.ip || '');

const sessionIcon = (s) => (s.platform === 'ios' || s.platform === 'android' ? 'smartphone' : 'monitor');

const formatWhen = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 10) return 'Active now';
    if (mins < 60) return `Active ${mins} min ago`;
    if (mins < 60 * 24) return `Active ${Math.round(mins / 60)} h ago`;
    return `Active ${d.toLocaleDateString()}`;
};

const SignedInDevices = ({ navigation }) => {
    const { colors } = useTheme();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [confirmOthers, setConfirmOthers] = useState(false);

    const load = useCallback(async () => {
        try {
            setSessions(await usersApi.listSessions());
        } catch (err) {
            AppAlert.alert('Signed-in devices', err?.response?.data?.message || 'Could not load your devices.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    const revoke = async (session) => {
        setBusyId(session.id);
        try {
            await usersApi.revokeSession(session.id);
            setSessions((list) => list.filter((s) => s.id !== session.id));
        } catch (err) {
            AppAlert.alert('Sign out device', err?.response?.data?.message || 'Could not sign out that device.');
        } finally {
            setBusyId(null);
        }
    };

    const revokeOthers = async () => {
        setConfirmOthers(false);
        setBusyId('others');
        try {
            await usersApi.revokeOtherSessions();
            setSessions((list) => list.filter((s) => s.current));
        } catch (err) {
            AppAlert.alert('Sign out other devices', err?.response?.data?.message || 'Could not sign out other devices.');
        } finally {
            setBusyId(null);
        }
    };

    const others = sessions.filter((s) => !s.current);

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Signed-in devices" />
            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={config.THEME_COLOR} />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
                >
                    <AppText
                        label="If you see a device you don't recognise, sign it out and change your password."
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginBottom: 16, lineHeight: 19 }}
                    />
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {sessions.length === 0 ? (
                            <AppText label="No devices recorded yet." fontSize={14} color={colors.textTertiary} style={{ padding: 16 }} />
                        ) : (
                            sessions.map((s, i) => (
                                <View key={s.id}>
                                    {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
                                    <View style={styles.row}>
                                        <View style={[styles.icon, { backgroundColor: colors.surfaceSecondary }]}>
                                            <Lucide name={sessionIcon(s)} size={20} color={config.THEME_COLOR} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <AppText label={sessionTitle(s)} variant={2} fontSize={15} color={colors.text} />
                                            <AppText
                                                label={[s.current ? 'This device' : formatWhen(s.last_seen_at), s.app_version ? `v${s.app_version}` : '', sessionIp(s)]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                                fontSize={12}
                                                color={s.current ? '#16a34a' : colors.textTertiary}
                                                style={{ marginTop: 2 }}
                                            />
                                        </View>
                                        {!s.current ? (
                                            <TouchableOpacity disabled={busyId != null} onPress={() => revoke(s)} style={styles.signOutBtn}>
                                                {busyId === s.id ? (
                                                    <ActivityIndicator size="small" color="#dc2626" />
                                                ) : (
                                                    <AppText label="Sign out" fontSize={13} color="#dc2626" />
                                                )}
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                    {others.length > 0 ? (
                        <TouchableOpacity
                            disabled={busyId != null}
                            onPress={() => setConfirmOthers(true)}
                            style={[styles.othersBtn, { borderColor: '#dc2626' }]}
                        >
                            {busyId === 'others' ? (
                                <ActivityIndicator size="small" color="#dc2626" />
                            ) : (
                                <AppText label="Sign out all other devices" variant={1} fontSize={15} color="#dc2626" />
                            )}
                        </TouchableOpacity>
                    ) : null}
                </ScrollView>
            )}
            <ConfirmDialog
                visible={confirmOthers}
                icon="log-out"
                title="Sign out other devices?"
                message="Every other phone, tablet and browser signed in to your account will need to sign in again."
                confirmLabel="Sign out"
                destructive
                onCancel={() => setConfirmOthers(false)}
                onConfirm={revokeOthers}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 66,
    },
    signOutBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 64,
        alignItems: 'center',
    },
    othersBtn: {
        marginTop: 20,
        height: 48,
        borderRadius: 999,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default SignedInDevices;
