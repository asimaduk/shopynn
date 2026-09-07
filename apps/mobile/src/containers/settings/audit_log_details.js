import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { Lucide } from '@react-native-vector-icons/lucide';
import useTheme from '../../hooks/useTheme';
import config from '../../config';

const AuditLogDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { log } = route.params || {};
    console.log('log', log);

    const backPress = () => {
        navigation.goBack();
    };

    if (!log) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label="Audit log details" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <AppText label="No audit log data." fontSize={14} color={colors.textSecondary} />
                </View>
            </SafeAreaView>
        );
    }

    let parsedDetails = null;
    try {
        parsedDetails = log.details ? JSON.parse(log.details) : null;
    } catch (e) {
        parsedDetails = null;
    }
console.log('parsedDetails', parsedDetails);
    const fullName = [log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || 'Unknown user';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label="Audit log details" />
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
                {/* Header card */}
                <View
                    style={{
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                >
                    <View
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: config.THEME_COLOR + '20',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12,
                        }}
                    >
                        <Lucide name="history" size={22} color={config.THEME_COLOR} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText
                            label={log.action || 'Audit event'}
                            variant={1}
                            fontSize={16}
                            color={colors.text}
                            numberOfLines={2}
                        />
                        <AppText
                            label={log.date}
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginTop: 4 }}
                        />
                    </View>
                </View>

                {/* Actor / Target info */}
                <View
                    style={{
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 16,
                    }}
                >
                    <AppText label="Actor" variant={1} fontSize={14} color={colors.text} />
                    <AppText
                        label={fullName}
                        fontSize={14}
                        color={colors.textSecondary}
                        style={{ marginTop: 4 }}
                    />
                    {log.user_email ? (
                        <AppText
                            label={log.user_email}
                            fontSize={13}
                            color={colors.textTertiary}
                            style={{ marginTop: 2 }}
                        />
                    ) : null}

                    <View
                        style={{
                            height: 1,
                            backgroundColor: colors.border,
                            marginVertical: 12,
                        }}
                    />

                    <AppText label="Target" variant={1} fontSize={14} color={colors.text} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <AppText
                            label={`${log.entity_type || 'Unknown'} • ${log.entity_id || 'N/A'}`}
                            fontSize={13}
                            color={colors.textSecondary}
                        />
                        {log.entity_id && (
                            <TouchableOpacity
                                onPress={() => {
                                    try {
                                        Clipboard.setString(String(log.entity_id));
                                        if (Toast && typeof Toast.show === 'function') {
                                            Toast.show({
                                                type: 'success',
                                                text1: 'Copied',
                                                text2: 'Entity ID copied to clipboard',
                                                visibilityTime: 1500,
                                            });
                                        }
                                    } catch (e) {
                                        // optional: ignore copy errors
                                    }
                                }}
                                style={{
                                    marginLeft: 8,
                                    padding: 4,
                                    borderRadius: 4,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Lucide name="copy" size={15} color={colors.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {log.ip_address ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                            <Lucide name="globe" size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
                            <AppText
                                label={log.ip_address}
                                fontSize={12}
                                color={colors.textTertiary}
                            />
                        </View>
                    ) : null}
                </View>

                {/* Details JSON */}
                <View
                    style={{
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    <AppText label="Details" variant={1} fontSize={14} color={colors.text} />
                    {parsedDetails?.updated_fields && Array.isArray(parsedDetails.updated_fields) ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                            {parsedDetails.updated_fields.map((field, idx) => (
                                <View
                                    key={idx}
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        borderRadius: 999,
                                        backgroundColor: config.THEME_COLOR + '12',
                                        marginRight: 6,
                                        marginBottom: 6,
                                    }}
                                >
                                    <AppText
                                        label={field}
                                        fontSize={12}
                                        color={config.THEME_COLOR}
                                    />
                                </View>
                            ))}
                        </View>
                    ) : null}

                    {/* Render additional parsedDetails JSON, excluding known keys like 'updated_fields' */}
                    {parsedDetails && typeof parsedDetails === 'object' && (
                        <View style={{ marginTop: 15 }}>
                            {Object.keys(parsedDetails)
                                .filter(
                                    (key) =>
                                        key !== 'updated_fields' &&
                                        parsedDetails[key] !== null &&
                                        parsedDetails[key] !== undefined
                                )
                                .map((key) => (
                                    <View key={key} style={{ marginBottom: 10 }}>
                                        <AppText
                                            label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            fontSize={12}
                                            color={colors.textSecondary}
                                            style={{ marginBottom: 2 }}
                                        />
                                        {typeof parsedDetails[key] === 'object' && parsedDetails[key] !== null ? (
                                            <View style={{ paddingLeft: 12 }}>
                                                {Object.entries(parsedDetails[key]).map(([childKey, childValue]) => (
                                                    <View key={childKey} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                                        <AppText
                                                            label={childKey.replace(/_/g, ' ')+': '}
                                                            fontSize={12}
                                                            color={colors.textTertiary}
                                                        />
                                                        <AppText
                                                            label={
                                                                typeof childValue === 'boolean'
                                                                    ? (childValue ? 'Yes' : 'No')
                                                                    : (childValue === null || childValue === undefined)
                                                                        ? '-'
                                                                        : String(childValue)
                                                            }
                                                            fontSize={12}
                                                            color={colors.text}
                                                        />
                                                    </View>
                                                ))}
                                            </View>
                                        ) : (
                                            <AppText
                                                label={
                                                    typeof parsedDetails[key] === 'boolean'
                                                        ? (parsedDetails[key] ? 'Yes' : 'No')
                                                        : String(parsedDetails[key])
                                                }
                                                fontSize={12}
                                                color={colors.text}
                                            />
                                        )}
                                    </View>
                                ))}
                        </View>
                    )}

                    {!parsedDetails && log.details ? (
                        <AppText
                            label={log.details}
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginTop: 8 }}
                        />
                    ) : null}

                    {!log.details && !parsedDetails && (
                        <AppText
                            label="No additional details."
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginTop: 8 }}
                        />
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default AuditLogDetails;

