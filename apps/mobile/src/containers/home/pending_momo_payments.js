import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    TextInput,
    StyleSheet,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { payments as paymentsApi, sales as salesApi, normalizeList } from '../../services/api';
import { buildInvoiceNumberFromSettings } from '../../utils/invoiceNumbering';
import { incrementInvoiceNext } from '../../store/actions/appSettings';
import { isTelecelMomoProvider, getMomoNetworkIcon } from '../../utils/momoNetworks';

const isSuccess = (status) => ['success', 'paid', 'completed'].includes(String(status || '').toLowerCase());

const momoStatusNeedsOtp = (status, displayText) => {
    const st = String(status || '').toLowerCase();
    if (st === 'send_otp' || st === 'otp' || st === 'send_pin' || st === 'pay_offline') return true;
    const t = String(displayText || '').toLowerCase();
    return /\botp\b|\bvoucher\b|\*110#/.test(t);
};

const productLines = (snapshot) => {
    if (!snapshot) return [];
    if (Array.isArray(snapshot.products)) return snapshot.products;
    if (Array.isArray(snapshot.currentOrder)) return snapshot.currentOrder;
    return [];
};

const lineQty = (line) => Number(line.order_quantity ?? line.quantity) || 1;
const linePrice = (line) => Number(line.unit_price) || 0;

const formatWhen = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const providerLabel = (provider) => {
    const key = String(provider || '').toLowerCase();
    if (key === 'vod' || key === 'vodafone' || key === 'telecel') return 'Telecel';
    if (key === 'tgo' || key === 'airteltigo' || key === 'at') return 'AirtelTigo';
    return 'MTN';
};

const PendingMomoPayments = ({ navigation }) => {
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const user = useSelector((s) => s.user?.user || s.user);
    const appSettings = useSelector((s) => s.appSettings || {});
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [listTab, setListTab] = useState('open'); // 'open' | 'abandoned'
    const [selectedRef, setSelectedRef] = useState(null);
    const [statusNote, setStatusNote] = useState('');
    const [needsOtp, setNeedsOtp] = useState(false);
    const [otp, setOtp] = useState('');
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    /** @type {[null | { ref: string, action: 'check' | 'complete' | 'abandon' | 'otp' }, Function]} */
    const [busy, setBusy] = useState(null);

    const selected = rows.find((r) => String(r.transaction_ref) === String(selectedRef)) || null;
    const viewingAbandoned = listTab === 'abandoned' || String(selected?.status || '').toLowerCase() === 'abandoned';

    const load = useCallback(async (tab = listTab) => {
        setLoading(true);
        try {
            const raw = await paymentsApi.posPending(
                tab === 'abandoned' ? { status: 'abandoned' } : undefined
            );
            const list = normalizeList(raw);
            setRows(list);
            return list;
        } catch (e) {
            setRows([]);
            Alert.alert('Pending MoMo', e?.response?.data?.message || e?.message || 'Could not load payments');
            return [];
        } finally {
            setLoading(false);
        }
    }, [listTab]);

    useFocusEffect(
        useCallback(() => {
            load(listTab);
        }, [load, listTab])
    );

    // Keep detail in sync; leave detail if row disappeared (completed / abandoned from open list).
    useEffect(() => {
        if (!selectedRef) return;
        const stillThere = rows.some((r) => String(r.transaction_ref) === String(selectedRef));
        if (!stillThere && !loading) {
            setSelectedRef(null);
            setStatusNote('');
            setNeedsOtp(false);
            setOtp('');
            setEvents([]);
        }
    }, [rows, selectedRef, loading]);

    const loadEvents = useCallback(async (paymentId) => {
        if (!paymentId) {
            setEvents([]);
            return;
        }
        setEventsLoading(true);
        try {
            const raw = await paymentsApi.events(paymentId);
            setEvents(Array.isArray(raw) ? raw : normalizeList(raw));
        } catch {
            setEvents([]);
        } finally {
            setEventsLoading(false);
        }
    }, []);

    const openDetail = (row) => {
        const snap = row?.pos_cart_snapshot || {};
        const provider = snap.provider || row?.provider || 'mtn';
        setSelectedRef(row.transaction_ref);
        setOtp('');
        setStatusNote('');
        setNeedsOtp(
            listTab !== 'abandoned' &&
                isTelecelMomoProvider(provider) &&
                !isSuccess(row?.status)
        );
        if (row?.id) loadEvents(row.id);
        else setEvents([]);
    };

    const closeDetail = () => {
        if (busy) return;
        setSelectedRef(null);
        setStatusNote('');
        setNeedsOtp(false);
        setOtp('');
        setEvents([]);
    };

    const switchTab = (tab) => {
        if (tab === listTab || busy) return;
        setSelectedRef(null);
        setEvents([]);
        setListTab(tab);
    };

    const handleCheckStatus = async (row) => {
        const ref = row?.transaction_ref;
        if (!ref || busy) return;
        setBusy({ ref, action: 'check' });
        try {
            const v = await paymentsApi.verify(ref);
            const st = String(v?.status || '').toLowerCase();
            const note = v?.display_text || '';
            if (isSuccess(st)) {
                setNeedsOtp(false);
                setStatusNote(note || 'Payment confirmed.');
                Alert.alert('Status', 'Payment confirmed.');
            } else if (momoStatusNeedsOtp(st, note) || isTelecelMomoProvider(row?.pos_cart_snapshot?.provider)) {
                setNeedsOtp(true);
                setStatusNote(note || 'Enter the OTP / voucher from the network.');
            } else {
                setNeedsOtp(false);
                setStatusNote(note || `Status: ${st || 'pending'}`);
            }
            await load();
        } catch (e) {
            Alert.alert('MoMo', e?.response?.data?.message || e?.message || 'Verify failed');
        } finally {
            setBusy(null);
        }
    };

    const handleSubmitOtp = async (row) => {
        const ref = row?.transaction_ref;
        const code = String(otp || '').trim();
        if (!ref || !code || busy) return;
        setBusy({ ref, action: 'otp' });
        try {
            const res = await paymentsApi.submitOtp({ reference: ref, otp: code });
            const st = String(res?.status || '').toLowerCase();
            if (isSuccess(st)) {
                setNeedsOtp(false);
                setStatusNote(res?.display_text || 'Payment confirmed.');
                setOtp('');
            } else if (momoStatusNeedsOtp(st, res?.display_text)) {
                setNeedsOtp(true);
                setStatusNote(res?.display_text || 'OTP / voucher still required.');
            } else {
                setStatusNote(res?.display_text || 'Submitted — waiting for confirmation.');
            }
            await load();
        } catch (e) {
            Alert.alert('MoMo', e?.response?.data?.message || e?.message || 'Could not submit OTP');
        } finally {
            setBusy(null);
        }
    };

    const handleComplete = async (row) => {
        const ref = row?.transaction_ref;
        const snap = row?.pos_cart_snapshot;
        const lines = productLines(snap);
        if (!ref || busy) return;
        if (!isSuccess(row?.status)) {
            Alert.alert('MoMo', 'Payment is not confirmed yet. Check status first.');
            return;
        }
        if (!lines.length) {
            Alert.alert(
                'MoMo',
                'No cart was saved with this payment. Complete this sale from New Sale with matching items, or abandon if it was a mistake.',
            );
            return;
        }
        setBusy({ ref, action: 'complete' });
        try {
            const products = lines.map((o) => ({
                id: o.id,
                quantity: lineQty(o),
                unit_price: linePrice(o),
                name: o.name || '',
            }));
            const total_amount =
                Number(row.face_amount) > 0
                    ? Math.round(Number(row.face_amount) * 100) / 100
                    : Math.round(products.reduce((s, p) => s + p.quantity * p.unit_price, 0) * 100) / 100;
            const invoiceNumber = buildInvoiceNumberFromSettings(appSettings);
            await salesApi.create({
                id: Date.now(),
                total_amount,
                discount_amount: 0,
                invoice_number: invoiceNumber,
                current_status: 1,
                customer_id: snap?.customer_id || null,
                customer: snap?.customer_name || 'Walk In',
                sale_date: new Date().toJSON(),
                products,
                notes: `Paid with momo ${row.payment_number || ''} ref ${ref}${
                    row.fee_amount ? ` (fee ${row.fee_amount})` : ''
                }`,
                cashier: user?.displayName || user?.first_name || '',
                created_at: new Date().toJSON(),
                warehouse_id: snap?.warehouse_id || user?.warehouse?.id,
                payment_method: 'momo',
                payment_number: row.payment_number || null,
                payment_reference: ref,
                payment_transaction_ref: ref,
                payment_type: 2,
            });
            dispatch(incrementInvoiceNext());
            Alert.alert('Sale', 'Sale completed.');
            setSelectedRef(null);
            setStatusNote('');
            setNeedsOtp(false);
            setOtp('');
            setEvents([]);
            await load('open');
        } catch (e) {
            Alert.alert('Sale', e?.response?.data?.message || e?.message || 'Could not complete sale');
        } finally {
            setBusy(null);
        }
    };

    const handleAbandon = (row) => {
        const ref = row?.transaction_ref;
        if (!ref || isSuccess(row?.status) || busy) return;
        Alert.alert(
            'Abandon payment?',
            'We will check the network first. If the customer already paid, abandon will be blocked and you must complete the sale.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Abandon',
                    style: 'destructive',
                    onPress: async () => {
                        setBusy({ ref, action: 'abandon' });
                        try {
                            await paymentsApi.posAbandon({ reference: ref });
                            setSelectedRef(null);
                            setStatusNote('');
                            setNeedsOtp(false);
                            setOtp('');
                            setEvents([]);
                            await load('open');
                        } catch (e) {
                            const code = e?.response?.data?.code || e?.code;
                            const msg =
                                e?.response?.data?.message || e?.message || 'Could not abandon';
                            if (code === 'PAYMENT_ALREADY_SUCCESS' || /already succeeded/i.test(String(msg))) {
                                Alert.alert('Already paid', msg);
                                await load('open');
                            } else {
                                Alert.alert('MoMo', msg);
                            }
                        } finally {
                            setBusy(null);
                        }
                    },
                },
            ]
        );
    };

    const renderListItem = ({ item }) => {
        const paid = isSuccess(item.status);
        const abandoned = String(item.status || '').toLowerCase() === 'abandoned';
        const lines = productLines(item.pos_cart_snapshot);
        const actor =
            [item.abandoned_by_first_name, item.abandoned_by_last_name].filter(Boolean).join(' ') ||
            [item.creator_first_name, item.creator_last_name].filter(Boolean).join(' ');
        const when = formatWhen(
            abandoned ? item.abandoned_at || item.updated_at || item.created_at : item.created_at
        );
        return (
            <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => openDetail(item)}
                style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
                <View style={styles.cardTop}>
                    <AppText
                        label={`₵ ${Number(item.face_amount ?? item.amount ?? 0).toFixed(2)}`}
                        variant={1}
                        color={colors.text}
                        fontSize={17}
                    />
                    <View
                        style={[
                            styles.statusChip,
                            {
                                backgroundColor: paid
                                    ? '#dcfce7'
                                    : abandoned
                                      ? '#f1f5f9'
                                      : '#ffedd5',
                            },
                        ]}
                    >
                        <AppText
                            label={paid ? 'Paid' : abandoned ? 'Abandoned' : String(item.status || 'pending')}
                            color={paid ? '#166534' : abandoned ? '#475569' : '#c2410c'}
                            fontSize={11}
                            variant={1}
                        />
                    </View>
                </View>
                <AppText
                    label={item.payment_number || '—'}
                    color={colors.textSecondary}
                    fontSize={13}
                />
                {when ? (
                    <View style={styles.metaInline}>
                        <Lucide name="clock" size={12} color={colors.textTertiary} />
                        <AppText
                            label={abandoned ? `Abandoned ${when}` : when}
                            color={colors.textTertiary}
                            fontSize={11}
                            style={{ marginLeft: 4 }}
                        />
                    </View>
                ) : null}
                {abandoned && actor ? (
                    <AppText
                        label={`By ${actor}`}
                        color={colors.textTertiary}
                        fontSize={11}
                        style={{ marginTop: 2 }}
                    />
                ) : null}
                <View style={styles.cardFooter}>
                    <AppText
                        label={`${lines.length || 0} item(s)`}
                        color={colors.textTertiary}
                        fontSize={12}
                    />
                    <View style={styles.metaInline}>
                        <AppText
                            label={abandoned ? 'Audit' : 'Details'}
                            color={colors.primary}
                            fontSize={12}
                        />
                        <Lucide name="chevron-right" size={16} color={colors.primary} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderDetail = () => {
        if (!selected) return null;
        const paid = isSuccess(selected.status);
        const snap = selected.pos_cart_snapshot || {};
        const lines = productLines(snap);
        const provider = snap.provider || 'mtn';
        const isTelecel = isTelecelMomoProvider(provider);
        const rowBusy = busy?.ref === selected.transaction_ref;
        const checking = rowBusy && busy?.action === 'check';
        const submittingOtp = rowBusy && busy?.action === 'otp';
        const completing = rowBusy && busy?.action === 'complete';
        const secondaryOpacity = checking || submittingOtp ? 0.35 : 1;
        const face = Number(selected.face_amount ?? selected.amount ?? 0);
        const fee = Number(selected.fee_amount) || 0;
        const when = formatWhen(selected.created_at);
        const networkName = providerLabel(provider);
        const abandoned = viewingAbandoned;

        return (
            <View style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={styles.detailContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View
                        style={[
                            styles.detailHero,
                            {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <View style={styles.heroTop}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <AppText label="Sale amount" fontSize={12} color={colors.textTertiary} />
                                <AppText
                                    label={`₵ ${face.toFixed(2)}`}
                                    variant={1}
                                    color={colors.text}
                                    fontSize={28}
                                    style={{ marginTop: 2 }}
                                />
                                {fee > 0 ? (
                                    <AppText
                                        label={`Customer pays ₵ ${(face + fee).toFixed(2)} incl. fee`}
                                        color={colors.textSecondary}
                                        fontSize={12}
                                        style={{ marginTop: 4 }}
                                    />
                                ) : null}
                            </View>
                            <View
                                style={[
                                    styles.statusChipLg,
                                    { backgroundColor: paid ? '#dcfce7' : '#ffedd5' },
                                ]}
                            >
                                <AppText
                                    label={paid ? 'Paid' : String(selected.status || 'pending')}
                                    color={paid ? '#166534' : '#c2410c'}
                                    fontSize={12}
                                    variant={1}
                                />
                            </View>
                        </View>

                        {when ? (
                            <View style={[styles.timestampRow, { backgroundColor: colors.surfaceSecondary || colors.background }]}>
                                <Lucide name="clock" size={14} color={config.THEME_COLOR} />
                                <AppText
                                    label={`Parked ${when}`}
                                    color={colors.text}
                                    fontSize={13}
                                    style={{ marginLeft: 8, flex: 1 }}
                                />
                            </View>
                        ) : null}

                        <View style={styles.metaGrid}>
                            <View style={styles.metaCell}>
                                <AppText label="Phone" fontSize={11} color={colors.textTertiary} />
                                <AppText
                                    label={selected.payment_number || '—'}
                                    variant={1}
                                    fontSize={14}
                                    color={colors.text}
                                    style={{ marginTop: 2 }}
                                />
                            </View>
                            <View style={styles.metaCell}>
                                <AppText label="Network" fontSize={11} color={colors.textTertiary} />
                                <View style={[styles.metaInline, { marginTop: 4 }]}>
                                    <Image
                                        source={getMomoNetworkIcon(provider)}
                                        style={styles.networkLogo}
                                        resizeMode="contain"
                                    />
                                    <AppText label={networkName} variant={1} fontSize={14} color={colors.text} />
                                </View>
                            </View>
                            {(snap.customer_name || snap.warehouse_name) && (
                                <>
                                    {snap.customer_name ? (
                                        <View style={styles.metaCell}>
                                            <AppText label="Customer" fontSize={11} color={colors.textTertiary} />
                                            <AppText
                                                label={snap.customer_name}
                                                variant={1}
                                                fontSize={14}
                                                color={colors.text}
                                                style={{ marginTop: 2 }}
                                                numberOfLines={1}
                                            />
                                        </View>
                                    ) : null}
                                    {snap.warehouse_name ? (
                                        <View style={styles.metaCell}>
                                            <AppText label="Store" fontSize={11} color={colors.textTertiary} />
                                            <AppText
                                                label={snap.warehouse_name}
                                                variant={1}
                                                fontSize={14}
                                                color={colors.text}
                                                style={{ marginTop: 2 }}
                                                numberOfLines={1}
                                            />
                                        </View>
                                    ) : null}
                                </>
                            )}
                        </View>

                        <AppText
                            label={`Ref ${selected.transaction_ref || ''}`}
                            color={colors.textTertiary}
                            fontSize={11}
                            style={{ marginTop: 12 }}
                        />
                    </View>

                    <View style={styles.sectionHeader}>
                        <AppText label="Items" variant={1} fontSize={14} color={colors.text} />
                        <AppText
                            label={`${lines.length} line${lines.length === 1 ? '' : 's'}`}
                            fontSize={12}
                            color={colors.textTertiary}
                        />
                    </View>

                    <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {lines.length === 0 ? (
                            <View style={{ padding: 16 }}>
                                <AppText
                                    label="No cart was saved with this payment."
                                    color={colors.textSecondary}
                                    fontSize={13}
                                />
                            </View>
                        ) : (
                            lines.map((line, idx) => {
                                const qty = lineQty(line);
                                const price = linePrice(line);
                                return (
                                    <View
                                        key={String(line.id || line.name || idx)}
                                        style={[
                                            styles.lineRow,
                                            idx < lines.length - 1 && {
                                                borderBottomWidth: StyleSheet.hairlineWidth,
                                                borderBottomColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <View style={styles.qtyPill}>
                                            <AppText label={`×${qty}`} fontSize={12} color={config.THEME_COLOR} variant={1} />
                                        </View>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <AppText label={line.name || 'Item'} color={colors.text} fontSize={14} />
                                            <AppText
                                                label={`₵ ${price.toFixed(2)} each`}
                                                color={colors.textTertiary}
                                                fontSize={12}
                                                style={{ marginTop: 2 }}
                                            />
                                        </View>
                                        <AppText
                                            label={`₵ ${(qty * price).toFixed(2)}`}
                                            variant={1}
                                            color={colors.text}
                                            fontSize={14}
                                        />
                                    </View>
                                );
                            })
                        )}
                    </View>

                    {!abandoned && !paid && (statusNote || needsOtp) ? (
                        <View
                            style={[
                                styles.hintBox,
                                {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                },
                            ]}
                        >
                            <Lucide name="info" size={16} color={config.THEME_COLOR} />
                            <AppText
                                label={
                                    statusNote ||
                                    (isTelecel
                                        ? 'Dial *110# on the Telecel line, then enter the voucher below.'
                                        : 'Enter the OTP from the network if prompted.')
                                }
                                color={colors.textSecondary}
                                fontSize={12}
                                style={{ flex: 1, marginLeft: 10 }}
                            />
                        </View>
                    ) : null}

                    {!abandoned && !paid && needsOtp ? (
                        <View style={{ marginTop: 12 }}>
                            <AppText
                                label={isTelecel ? 'Telecel voucher' : 'OTP'}
                                variant={1}
                                color={colors.text}
                                style={{ marginBottom: 8 }}
                            />
                            <TextInput
                                placeholder={isTelecel ? 'Voucher code' : 'Enter OTP'}
                                placeholderTextColor={colors.placeholder}
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                editable={!rowBusy}
                                style={[
                                    styles.otpInput,
                                    {
                                        borderColor: colors.inputBorder || colors.border,
                                        color: colors.text,
                                        backgroundColor: colors.surface,
                                    },
                                ]}
                            />
                            <TouchableOpacity
                                activeOpacity={0.85}
                                disabled={rowBusy || !String(otp || '').trim()}
                                onPress={() => handleSubmitOtp(selected)}
                                style={[
                                    styles.primaryBtn,
                                    {
                                        backgroundColor: config.THEME_COLOR,
                                        opacity: rowBusy || !String(otp || '').trim() ? 0.5 : 1,
                                    },
                                ]}
                            >
                                {submittingOtp ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <AppText
                                        label={isTelecel ? 'Submit voucher' : 'Submit OTP'}
                                        color="#fff"
                                        variant={1}
                                    />
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <View style={styles.sectionHeader}>
                        <AppText label="Activity" variant={1} fontSize={14} color={colors.text} />
                        {eventsLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                    </View>
                    <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {!eventsLoading && events.length === 0 ? (
                            <View style={{ padding: 16 }}>
                                <AppText
                                    label="No activity recorded yet."
                                    color={colors.textSecondary}
                                    fontSize={13}
                                />
                            </View>
                        ) : (
                            events.map((ev, idx) => {
                                const actor = [ev.actor_first_name, ev.actor_last_name]
                                    .filter(Boolean)
                                    .join(' ');
                                const when = formatWhen(ev.created_at);
                                const label = String(ev.event_type || 'event').replace(/_/g, ' ');
                                return (
                                    <View
                                        key={String(ev.id || idx)}
                                        style={[
                                            styles.eventRow,
                                            idx < events.length - 1 && {
                                                borderBottomWidth: StyleSheet.hairlineWidth,
                                                borderBottomColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.eventDot,
                                                {
                                                    backgroundColor:
                                                        String(ev.event_type || '').includes('abandon')
                                                            ? '#94a3b8'
                                                            : config.THEME_COLOR,
                                                },
                                            ]}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <AppText label={label} variant={1} fontSize={13} color={colors.text} />
                                            {ev.note ? (
                                                <AppText
                                                    label={ev.note}
                                                    fontSize={12}
                                                    color={colors.textSecondary}
                                                    style={{ marginTop: 2 }}
                                                />
                                            ) : null}
                                            <AppText
                                                label={[when, actor ? `by ${actor}` : null]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                                fontSize={11}
                                                color={colors.textTertiary}
                                                style={{ marginTop: 4 }}
                                            />
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </ScrollView>

                <View
                    style={[
                        styles.footer,
                        {
                            backgroundColor: colors.surface,
                            borderTopColor: colors.border,
                        },
                    ]}
                >
                    {viewingAbandoned ? (
                        <AppText
                            label="This payment was abandoned. Review activity above for who did it and when."
                            color={colors.textSecondary}
                            fontSize={13}
                            style={{ textAlign: 'center' }}
                        />
                    ) : !paid ? (
                        <>
                            <TouchableOpacity
                                disabled={rowBusy}
                                onPress={() => handleCheckStatus(selected)}
                                style={[
                                    styles.primaryBtn,
                                    { backgroundColor: config.THEME_COLOR, opacity: rowBusy ? 0.7 : 1 },
                                ]}
                            >
                                {checking ? (
                                    <View style={styles.rowCenter}>
                                        <ActivityIndicator size="small" color="#fff" />
                                        <AppText label="Checking…" color="#fff" fontSize={15} variant={1} />
                                    </View>
                                ) : (
                                    <AppText label="Check status" color="#fff" fontSize={15} variant={1} />
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={rowBusy}
                                onPress={() => handleAbandon(selected)}
                                style={{ alignItems: 'center', paddingVertical: 12, opacity: secondaryOpacity }}
                            >
                                <AppText
                                    label="Abandon payment"
                                    color={colors.error || '#dc2626'}
                                    fontSize={14}
                                />
                            </TouchableOpacity>
                        </>
                    ) : lines.length > 0 ? (
                        <TouchableOpacity
                            disabled={rowBusy}
                            onPress={() => handleComplete(selected)}
                            style={[
                                styles.primaryBtn,
                                { backgroundColor: config.THEME_COLOR, opacity: rowBusy ? 0.55 : 1 },
                            ]}
                        >
                            {completing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <AppText label="Complete sale" color="#fff" fontSize={15} variant={1} />
                            )}
                        </TouchableOpacity>
                    ) : (
                        <AppText
                            label="Paid, but no cart was saved — finish manually if needed."
                            color={colors.textSecondary}
                            fontSize={13}
                            style={{ textAlign: 'center' }}
                        />
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: colors.background }}
            edges={['bottom', 'left', 'right']}
        >
            <ScreenHeader
                onPress={selected ? closeDetail : () => navigation.goBack()}
                label={
                    selected
                        ? viewingAbandoned
                            ? 'Abandoned MoMo'
                            : 'MoMo details'
                        : 'Pending MoMo'
                }
            >
                {!selected ? (
                    <TouchableOpacity
                        onPress={() => load(listTab)}
                        style={{ padding: 8 }}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : (
                            <Lucide name="refresh-cw" size={20} color={colors.text} />
                        )}
                    </TouchableOpacity>
                ) : null}
            </ScreenHeader>

            {!selected ? (
                <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
                    {[
                        { id: 'open', label: 'Open' },
                        { id: 'abandoned', label: 'Abandoned' },
                    ].map((tab) => {
                        const active = listTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => switchTab(tab.id)}
                                style={[
                                    styles.tabBtn,
                                    active && {
                                        borderBottomColor: config.THEME_COLOR,
                                        borderBottomWidth: 2,
                                    },
                                ]}
                            >
                                <AppText
                                    label={tab.label}
                                    variant={active ? 1 : 2}
                                    color={active ? config.THEME_COLOR : colors.textSecondary}
                                    fontSize={14}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ) : null}

            {selected ? (
                renderDetail()
            ) : (
                <FlashList
                    data={rows}
                    estimatedItemSize={110}
                    keyExtractor={(item) => String(item.id || item.transaction_ref)}
                    renderItem={renderListItem}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={() => load(listTab)} />
                    }
                    ListEmptyComponent={
                        !loading ? (
                            <View style={{ padding: 32, alignItems: 'center' }}>
                                <AppText
                                    label={
                                        listTab === 'abandoned'
                                            ? 'No abandoned MoMo payments'
                                            : 'No pending MoMo payments'
                                    }
                                    color={colors.textSecondary}
                                />
                                <AppText
                                    label={
                                        listTab === 'abandoned'
                                            ? 'Abandoned charges from the last 30 days appear here with who abandoned them.'
                                            : 'After Send on New Sale, tap Park to finish later here.'
                                    }
                                    color={colors.textTertiary}
                                    fontSize={12}
                                    style={{ marginTop: 8, textAlign: 'center' }}
                                />
                            </View>
                        ) : null
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    statusChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    statusChipLg: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        alignSelf: 'flex-start',
    },
    metaInline: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    detailContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24,
    },
    detailHero: {
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    timestampRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        marginBottom: 12,
    },
    metaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metaCell: {
        width: '47%',
        minWidth: 140,
    },
    networkLogo: {
        width: 18,
        height: 18,
        borderRadius: 4,
        marginRight: 6,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 18,
        marginBottom: 8,
    },
    detailCard: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
    },
    lineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    qtyPill: {
        minWidth: 36,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${config.THEME_COLOR}14`,
        marginRight: 10,
    },
    hintBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 14,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    otpInput: {
        height: 46,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        marginBottom: 10,
    },
    primaryBtn: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    rowCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginBottom: 4,
    },
    tabBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
    },
    eventDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 5,
    },
});

export default PendingMomoPayments;
