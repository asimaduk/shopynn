import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import TourMapGraphic from './TourMapGraphic';

/** Absolute overlay — avoids stacking RN Modals with other app sheets. */
export default function TourCatalogModal({
    visible,
    onClose,
    catalog,
    tourPrefs,
    onStart,
}) {
    const { colors } = useTheme();

    if (!visible) return null;

    return (
        <View style={styles.root} pointerEvents="box-none">
            <View style={styles.backdrop}>
                <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.header}>
                        <AppText label="Take a tour" variant={1} fontSize={18} color={colors.text} />
                        <Pressable onPress={onClose} hitSlop={10}>
                            <Lucide name="x" size={22} color={colors.textTertiary} />
                        </Pressable>
                    </View>
                    <TourMapGraphic compact pinLabel="Pick a guide" />
                    <AppText
                        label="Short walkthroughs of the main areas. Start with the overview if you are new."
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginBottom: 12, marginTop: 10, lineHeight: 18 }}
                    />
                    <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                        {catalog.length === 0 ? (
                            <AppText
                                label="No tours are available for your account permissions."
                                fontSize={14}
                                color={colors.textSecondary}
                            />
                        ) : (
                            catalog.map((tour) => {
                                const doneAt = tourPrefs?.completed?.[tour.id];
                                const overviewDone =
                                    tour.id === 'overview' &&
                                    (tourPrefs?.overviewStatus === 'completed' ||
                                        tourPrefs?.overviewStatus === 'skipped');
                                const done = Boolean(doneAt) || overviewDone;
                                return (
                                    <View
                                        key={tour.id}
                                        style={[
                                            styles.row,
                                            { borderBottomColor: colors.border },
                                        ]}
                                    >
                                        <View style={{ flex: 1, paddingRight: 12 }}>
                                            <AppText
                                                label={tour.title}
                                                variant={1}
                                                fontSize={15}
                                                color={colors.text}
                                            />
                                            <AppText
                                                label={
                                                    done
                                                        ? `${tour.description} · Done`
                                                        : tour.description
                                                }
                                                fontSize={12}
                                                color={colors.textTertiary}
                                                style={{ marginTop: 2 }}
                                            />
                                        </View>
                                        <Pressable
                                            onPress={() => onStart(tour.id)}
                                            style={[
                                                styles.startBtn,
                                                { backgroundColor: config.THEME_COLOR },
                                            ]}
                                        >
                                            <AppText
                                                label={done ? 'Replay' : 'Start'}
                                                color="#fff"
                                                variant={1}
                                                fontSize={13}
                                            />
                                        </Pressable>
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                    <Pressable onPress={onClose} style={styles.closeBtn}>
                        <AppText label="Close" fontSize={14} color={colors.textSecondary} />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10050,
        elevation: 10050,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 28,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    startBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    closeBtn: {
        alignItems: 'center',
        marginTop: 12,
        paddingVertical: 8,
    },
});
