import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, ActivityIndicator, Linking, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import SuccessDialog from '../../components/SuccessDialog';
import useTheme from '../../hooks/useTheme';
import InvoiceShareSheet from '../../components/invoice_share_sheet';
import { formatCurrency, formatQuantity, formatPhone, inferGhanaMomoNetwork } from '../../utils/format';
import { formatSalePaymentLabel, salePaymentIcon } from '../../utils/salePayment';
import { sales as salesApi, payments as paymentsApi } from '../../services/api';
import {
    MOMO_NETWORK_OPTIONS,
    isTelecelMomoProvider,
    normalizeGhanaMomoNumber,
    validateMomoNumberForProvider,
} from '../../utils/momoNetworks';
import { hasPermission } from '../../utils/permissions';
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

const paymentStatusLabel = (status) => {
    const n = Number(status);
    if (n === 1) return 'Paid';
    if (n === 2) return 'Partial';
    if (n === 0) return 'On credit';
    return '—';
};

const COLLECT_METHOD_LABELS = { cash: 'Cash', momo: 'MoMo', store_credit: 'Store credit' };
const EMPTY_MOMO = { ref: null, face: 0, charge: 0, paid: false, needsOtp: false, status: '' };
const newRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const momoStatusNeedsOtp = (status, displayText) => {
    const st = String(status || '').toLowerCase();
    if (st === 'send_otp' || st === 'otp' || st === 'send_pin' || st === 'pay_offline') return true;
    return /\botp\b|\bvoucher\b|\*110#/.test(String(displayText || '').toLowerCase());
};
const momoErrorMessage = (e, fallback) =>
    e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;

const SaleDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const appSettings = useSelector((s) => s.appSettings) || {};
    const { item: paramItem, saleId, mode } = route.params || {};
    const [item, setItem] = useState(paramItem);
    const isPendingUpload = mode === 'pending-upload' || !!paramItem?.payload;
    const [loading, setLoading] = useState(!isPendingUpload && !!(saleId || paramItem?.id));
    const [showInvoiceShare, setShowInvoiceShare] = useState(false);
    const [resendingInvoice, setResendingInvoice] = useState(false);
    const canResendInvoice = hasPermission(user, 'sales.share_receipt');
    const canCollect = hasPermission(user, 'sales.create');

    const [showCollectModal, setShowCollectModal] = useState(false);
    const [collectAmount, setCollectAmount] = useState('');
    const [collectMethod, setCollectMethod] = useState('cash');
    const [collectNote, setCollectNote] = useState('');
    const [savingCollect, setSavingCollect] = useState(false);
    const [momoPhone, setMomoPhone] = useState('');
    const [momoProvider, setMomoProvider] = useState('mtn');
    const [momo, setMomo] = useState(EMPTY_MOMO);
    const [momoOtp, setMomoOtp] = useState('');
    const [momoBusy, setMomoBusy] = useState(false);
    const savingRef = useRef(false);
    const momoCheckingRef = useRef(false);
    const requestIdRef = useRef(null);

    const [dialog, setDialog] = useState(null);
    const showNotice = (title, message, icon = 'circle-alert') =>
        setDialog({ type: 'confirm', title, message, icon, hideCancel: true, confirmLabel: 'OK' });
    const showConfirm = (opts) => setDialog({ type: 'confirm', ...opts });
    const showSuccess = (opts) => setDialog({ type: 'success', ...opts });
    const handleDialogAction = (key) => {
        const action = dialog?.[key];
        setDialog(null);
        if (action) action();
    };

    const reloadSale = async () => {
        const id = saleId || paramItem?.id || item?.id;
        if (!id || isPendingUpload) return;
        try {
            const data = await salesApi.get(id);
            if (data) setItem((prev) => ({ ...prev, ...data }));
        } catch (_) {
            /* keep current */
        }
    };

    useEffect(() => {
        const id = saleId || paramItem?.id;
        if (isPendingUpload) return;
        if (!id) return;
        let mounted = true;
        setLoading(true);
        salesApi.get(id).then((data) => {
            if (mounted && data) setItem((prev) => ({ ...prev, ...data }));
        }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [saleId, paramItem?.id]);

    const balanceDue = Number(item?.balance_due ?? 0);
    const amountPaid = Number(item?.amount_paid ?? 0);
    const storeCreditBalance = Number(item?.store_credit_balance ?? 0);
    const canCollectPayment = !isPendingUpload && canCollect && (item?.can_collect_payment || balanceDue > 0.02);

    const canUseStoreCredit = !!item?.customer_id && storeCreditBalance > 0.001;
    const collectMethods = canUseStoreCredit ? ['cash', 'momo', 'store_credit'] : ['cash', 'momo'];
    const collectInputStyle = {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.text,
        marginBottom: 12,
        backgroundColor: colors.inputBackground || colors.surface,
    };
    const momoLocked = !!momo.ref;

    const openCollectModal = () => {
        const phone = normalizeGhanaMomoNumber(item?.customer_phone);
        const network = MOMO_NETWORK_OPTIONS.find((n) => n.id === inferGhanaMomoNetwork(phone));
        setCollectAmount(balanceDue > 0 ? balanceDue.toFixed(2) : '');
        setCollectMethod('cash');
        setCollectNote('');
        setMomoPhone(phone);
        setMomoProvider(network?.provider || 'mtn');
        setMomo(EMPTY_MOMO);
        setMomoOtp('');
        requestIdRef.current = newRequestId();
        setShowCollectModal(true);
    };

    const closeCollectModal = () => {
        if (savingCollect || momoBusy) return;
        if (momo.paid && momo.ref) {
            const { ref, face } = momo;
            showConfirm({
                icon: 'wallet',
                title: 'MoMo payment not recorded',
                message: `${formatCurrency(face)} was received by MoMo but is not yet recorded on this sale.`,
                cancelLabel: 'Close anyway',
                confirmLabel: 'Record now',
                onCancel: () => setShowCollectModal(false),
                onConfirm: () => saveCollectPayment({ momoRef: ref, momoFace: face }),
            });
            return;
        }
        setShowCollectModal(false);
    };

    /** Returns the validated amount, or null after alerting. */
    const validateCollectAmount = (method) => {
        const amt = Number(String(collectAmount).replace(/,/g, ''));
        if (!Number.isFinite(amt) || amt < 0.01) {
            showNotice('Amount required', 'Enter how much is being collected.');
            return null;
        }
        if (amt > balanceDue + 0.02) {
            showNotice('Amount too high', `Balance due is ${formatCurrency(balanceDue)}.`);
            return null;
        }
        if (method === 'store_credit') {
            if (!item?.customer_id) {
                showNotice('Customer required', 'Store credit can only be applied when the sale has a customer.');
                return null;
            }
            if (amt > storeCreditBalance + 0.02) {
                showNotice('Not enough store credit', `Available store credit is ${formatCurrency(storeCreditBalance)}.`);
                return null;
            }
        }
        return Math.round(amt * 100) / 100;
    };

    const saveCollectPayment = async (confirmedMomo = null) => {
        const id = saleId || item?.id;
        if (!id || savingRef.current) return;
        const method = confirmedMomo ? 'momo' : collectMethod;
        let amt;
        let momoRef = null;
        if (method === 'momo') {
            momoRef = confirmedMomo?.momoRef || (momo.paid ? momo.ref : null);
            if (!momoRef) {
                showNotice('MoMo not confirmed', 'Send the MoMo prompt and wait for the customer to approve it.');
                return;
            }
            amt = confirmedMomo?.momoFace || momo.face;
        } else {
            amt = validateCollectAmount(method);
            if (amt == null) return;
        }
        savingRef.current = true;
        setSavingCollect(true);
        try {
            const body = {
                amount: amt,
                payment_method: method,
                note: collectNote.trim() || null,
                client_request_id: requestIdRef.current,
            };
            if (method === 'momo') {
                body.payment_transaction_ref = momoRef;
                body.payment_reference = momoRef;
                body.payment_number = normalizeGhanaMomoNumber(momoPhone) || null;
            }
            const result = await salesApi.recordPayment(id, body);
            setMomo(EMPTY_MOMO);
            setShowCollectModal(false);
            await reloadSale();
            const remaining = Number(result?.balance_due ?? Math.max(0, balanceDue - amt));
            const fullyPaid = result?.fully_paid ?? remaining <= 0.02;
            // iOS drops a Modal presented while another is still dismissing.
            setTimeout(() => {
                showSuccess({
                    title: fullyPaid ? 'Sale fully paid' : 'Payment recorded',
                    message: fullyPaid
                        ? `${formatCurrency(amt)} collected. Nothing is owed on this sale.`
                        : `${formatCurrency(amt)} collected.`,
                    details: [
                        { icon: 'wallet', label: 'Amount', value: formatCurrency(amt) },
                        { icon: 'credit-card', label: 'Method', value: COLLECT_METHOD_LABELS[method] },
                        { icon: 'scale', label: 'Balance left', value: formatCurrency(remaining) },
                    ],
                });
            }, 400);
        } catch (error) {
            showNotice('Could not save', momoErrorMessage(error, 'Try again.'));
        } finally {
            savingRef.current = false;
            setSavingCollect(false);
        }
    };

    const markMomoPaid = (ref, face) => {
        setMomo((m) => ({ ...m, ref, face, paid: true, needsOtp: false, status: 'MoMo payment confirmed.' }));
        saveCollectPayment({ momoRef: ref, momoFace: face });
    };

    const sendMomoPrompt = async ({ forceNew = false } = {}) => {
        const amt = validateCollectAmount('momo');
        if (amt == null) return;
        const check = validateMomoNumberForProvider(momoPhone, momoProvider);
        if (!check.ok) {
            showNotice('Check the MoMo number', check.message, 'smartphone');
            return;
        }
        setMomoBusy(true);
        setMomoOtp('');
        setMomo({ ...EMPTY_MOMO, status: forceNew ? 'Starting a new MoMo prompt…' : 'Sending MoMo prompt…' });
        try {
            const res = await paymentsApi.initiate({
                face_amount: amt,
                payment_method: 'mobile_money',
                phone: check.digits,
                provider: momoProvider,
                source: 'pos_sale',
                payment_number: check.digits,
                force_new: forceNew,
            });
            const ref = res?.transaction_ref;
            if (!ref) {
                setMomo(EMPTY_MOMO);
                showNotice('MoMo not started', 'No payment reference was returned. Try again.');
                return;
            }
            const face = Number(res?.face_amount) || amt;
            const charge = Number(res?.charge_amount) || face;
            if (res?.reused || String(res?.status || '').toLowerCase() === 'success') {
                setMomo({ ...EMPTY_MOMO, ref, face, charge });
                markMomoPaid(ref, face);
                return;
            }
            const telecel = isTelecelMomoProvider(momoProvider);
            setMomo({
                ref,
                face,
                charge,
                paid: false,
                needsOtp: telecel || momoStatusNeedsOtp(res?.status, res?.display_text),
                status:
                    res?.display_text ||
                    (telecel
                        ? 'Ask the customer to dial *110#, then enter the voucher below.'
                        : 'Ask the customer to approve the MoMo prompt on their phone.'),
            });
        } catch (e) {
            setMomo(EMPTY_MOMO);
            showNotice('MoMo not started', momoErrorMessage(e, 'Could not start MoMo payment.'));
        } finally {
            setMomoBusy(false);
        }
    };

    const checkMomoStatus = async ({ silent = false } = {}) => {
        const { ref, face } = momo;
        if (!ref || momo.paid || momoCheckingRef.current) return;
        momoCheckingRef.current = true;
        if (!silent) setMomoBusy(true);
        try {
            const v = await paymentsApi.verify(ref);
            const st = String(v?.status || '').toLowerCase();
            if (st === 'success' || st === 'paid' || st === 'completed') {
                markMomoPaid(ref, face);
            } else if (st === 'failed' || st === 'abandoned' || st === 'reversed') {
                setMomo({ ...EMPTY_MOMO, status: v?.display_text || 'MoMo payment failed. Send a new prompt.' });
            } else if (momoStatusNeedsOtp(st, v?.display_text)) {
                setMomo((m) => ({ ...m, needsOtp: true, status: v?.display_text || 'Enter the OTP / voucher from the network.' }));
            } else if (!silent) {
                setMomo((m) => ({ ...m, status: v?.display_text || 'Still waiting for the customer to approve.' }));
            }
        } catch (e) {
            if (!silent) showNotice('Could not check status', momoErrorMessage(e, 'Try again in a moment.'));
        } finally {
            momoCheckingRef.current = false;
            if (!silent) setMomoBusy(false);
        }
    };

    const submitMomoOtp = async () => {
        const otp = momoOtp.trim();
        if (!momo.ref || !otp) {
            showNotice(
                'Code required',
                isTelecelMomoProvider(momoProvider) ? 'Enter the voucher from *110#.' : 'Enter the OTP from the network.',
                'key-round',
            );
            return;
        }
        setMomoBusy(true);
        try {
            const res = await paymentsApi.submitOtp({ reference: momo.ref, otp });
            const st = String(res?.status || '').toLowerCase();
            if (st === 'success') {
                markMomoPaid(momo.ref, momo.face);
            } else {
                setMomoOtp('');
                setMomo((m) => ({
                    ...m,
                    needsOtp: isTelecelMomoProvider(momoProvider) || momoStatusNeedsOtp(st, res?.display_text),
                    status: res?.display_text || 'Submitted. Waiting for confirmation…',
                }));
            }
        } catch (e) {
            showNotice('Code not accepted', momoErrorMessage(e, 'Could not submit the code.'));
        } finally {
            setMomoBusy(false);
        }
    };

    const resendMomoPrompt = () => {
        const { ref, face } = momo;
        showConfirm({
            icon: 'refresh-cw',
            title: 'Send a new prompt?',
            message: 'This cancels the open prompt. Only do this if the customer did not get it or it timed out.',
            confirmLabel: 'Send again',
            destructive: true,
            onConfirm: async () => {
                if (ref) {
                    try {
                        await paymentsApi.posAbandon({ reference: ref });
                    } catch (e) {
                        if (/already succeeded/i.test(String(momoErrorMessage(e, '')))) {
                            markMomoPaid(ref, face);
                            return;
                        }
                    }
                }
                sendMomoPrompt({ forceNew: true });
            },
        });
    };

    const selectCollectMethod = (m) => {
        if (m === collectMethod) return;
        if (momo.paid && momo.ref) {
            showNotice('MoMo already received', 'Record the confirmed MoMo payment before switching method.', 'wallet');
            return;
        }
        if (momo.ref) {
            paymentsApi.posAbandon({ reference: momo.ref }).catch(() => {});
        }
        setMomo(EMPTY_MOMO);
        setMomoOtp('');
        setCollectMethod(m);
        if (m === 'store_credit') {
            setCollectAmount(Math.min(balanceDue, storeCreditBalance).toFixed(2));
        }
    };

    const checkMomoStatusRef = useRef(checkMomoStatus);
    checkMomoStatusRef.current = checkMomoStatus;

    useEffect(() => {
        if (!showCollectModal || collectMethod !== 'momo' || !momo.ref || momo.paid || momo.needsOtp) return undefined;
        const timer = setInterval(() => checkMomoStatusRef.current({ silent: true }), 5000);
        const stop = setTimeout(() => clearInterval(timer), 3 * 60 * 1000);
        return () => {
            clearInterval(timer);
            clearTimeout(stop);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCollectModal, collectMethod, momo.ref, momo.paid, momo.needsOtp]);

    const removePendingSaleById = async (pendingId) => {
        const list = await readSecureList(PENDING_SALES_KEY);
        const next = Array.isArray(list) ? list.filter((x) => String(x?.id) !== String(pendingId)) : [];
        await writeSecureList(PENDING_SALES_KEY, next);
        return next;
    };

    const updatePendingSale = async (pendingId, updater) => {
        const list = await readSecureList(PENDING_SALES_KEY);
        const next = (Array.isArray(list) ? list : []).map((x) => {
            if (String(x?.id) !== String(pendingId)) return x;
            return updater(x);
        });
        await writeSecureList(PENDING_SALES_KEY, next);
        return next;
    };

    const handleRetryPendingUpload = async () => {
        const pendingId = item?.id;
        if (!pendingId || !item?.payload) return;
        try {
            await salesApi.create(item.payload);
            await removePendingSaleById(pendingId);
            showSuccess({
                title: 'Sale uploaded',
                message: 'This pending sale is now saved to your sales.',
                primaryLabel: 'Back to sales',
                onPrimary: () => navigation.goBack(),
            });
        } catch (err) {
            const nowIso = new Date().toISOString();
            const nextItem = {
                ...item,
                attempts: (Number(item?.attempts) || 0) + 1,
                last_attempt_at: nowIso,
                last_error_code: getErrorCode(err) || item?.last_error_code || null,
                last_error_message: getErrorMessage(err) || item?.last_error_message || null,
            };
            setItem(nextItem);
            await updatePendingSale(pendingId, () => nextItem);
            showNotice('Upload failed', nextItem.last_error_message || 'Could not upload this sale.', 'cloud-off');
        }
    };

    const handleEditPendingSale = () => {
        const pendingId = item?.id;
        showConfirm({
            icon: 'pencil',
            title: 'Edit pending sale?',
            message: 'This will remove it from Pending Sales and open it in New Sale for editing.',
            confirmLabel: 'Edit',
            onConfirm: async () => {
                if (pendingId) await removePendingSaleById(pendingId);
                navigation.navigate('NewSale', { restorePendingSale: item });
            },
        });
    };

    const handleDeletePendingSale = () => {
        const pendingId = item?.id;
        showConfirm({
            icon: 'trash-2',
            title: 'Delete pending sale?',
            message: 'This will remove it from Pending Sales.',
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
                if (pendingId) await removePendingSaleById(pendingId);
                navigation.goBack();
            },
        });
    };

    const backPress = () => {
        navigation.goBack();
    };

    const handleResendInvoice = () => {
        const id = saleId || item?.id;
        if (!id || isPendingUpload) return;
        const emailHint = item?.customer_email ? ` to ${item.customer_email}` : '';
        showConfirm({
            icon: 'mail',
            title: 'Resend invoice?',
            message: `Email invoice #${item?.invoice_number}${emailHint}?`,
            confirmLabel: 'Resend',
            onConfirm: async () => {
                setResendingInvoice(true);
                try {
                    const result = await salesApi.sendInvoice(
                        id,
                        item?.customer_email ? { email: item.customer_email } : {},
                    );
                    showSuccess({
                        icon: 'mail-check',
                        title: 'Invoice sent',
                        message: `Invoice resent to ${result?.sent_to || item?.customer_email || 'customer'}.`,
                        primaryLabel: 'Done',
                    });
                } catch (err) {
                    const msg = err?.response?.data?.message || err?.message || 'Could not resend invoice.';
                    showNotice('Resend failed', msg);
                } finally {
                    setResendingInvoice(false);
                }
            },
        });
    };

    const handleCallCustomer = async () => {
        const phone = String(item.customer_phone || '').trim();
        if (!phone) return;
        const url = `tel:${phone}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                showNotice('Calls not available', 'This device cannot make phone calls.', 'phone-off');
            }
        } catch (err) {
            showNotice('Call failed', err?.message || 'Failed to start the call.', 'phone-off');
        }
    };

    const dialogs = (
        <>
            <ConfirmDialog
                visible={dialog?.type === 'confirm'}
                icon={dialog?.icon || 'circle-alert'}
                title={dialog?.title || ''}
                message={dialog?.message}
                cancelLabel={dialog?.cancelLabel || 'Cancel'}
                confirmLabel={dialog?.confirmLabel || 'OK'}
                destructive={!!dialog?.destructive}
                hideCancel={!!dialog?.hideCancel}
                onCancel={() => handleDialogAction('onCancel')}
                onConfirm={() => handleDialogAction('onConfirm')}
            />
            <SuccessDialog
                visible={dialog?.type === 'success'}
                icon={dialog?.icon || 'check'}
                title={dialog?.title || ''}
                message={dialog?.message}
                details={dialog?.details}
                primaryLabel={dialog?.primaryLabel || 'Done'}
                onPrimary={() => handleDialogAction('onPrimary')}
            />
        </>
    );

    const DetailSection = ({ title, children }) => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <AppText label={title} fontSize={16} variant={1} style={[styles.sectionTitle, { color: colors.text }]} />
            {children}
        </View>
    );

    const DetailRow = ({ icon, label, value }) => (
        <View style={styles.detailRow}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surfaceSecondary }]}>
                <Lucide name={icon} color={colors.textSecondary} size={18} />
            </View>
            <View style={{ flex: 1 }}>
                <AppText label={label} fontSize={12} color={colors.textTertiary} />
                <AppText label={value} fontSize={15} color={colors.text} />
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading sale..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label={'Sale Details'}>
                <View style={{ flexDirection: 'row', paddingRight: 10, gap: 8 }}>
                    {!isPendingUpload && canResendInvoice ? (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={handleResendInvoice}
                            disabled={resendingInvoice}
                            style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                        >
                            {resendingInvoice ? (
                                <ActivityIndicator size="small" color={config.THEME_COLOR} />
                            ) : (
                                <Lucide name="mail" color={config.THEME_COLOR} size={20} />
                            )}
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => setShowInvoiceShare(true)}
                        style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Lucide name="file-text" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                    {/* <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate("NewSale", {item: item})}
                        style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Lucide name="redo-dot" color={colors.textSecondary} size={20} />
                    </TouchableOpacity> */}
                </View>
            </ScreenHeader>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                {isPendingUpload && (
                    <View style={[styles.section, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.iconContainer, { backgroundColor: colors.warningLight }]}>
                                    <Lucide name="cloud-off" size={18} color={colors.warning} />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <AppText label="Pending upload" variant={1} fontSize={15} color={colors.text} />
                                    <AppText
                                        label={(item?.last_error_message || 'Will upload when internet is available.').trim()}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 2, maxWidth: 260 }}
                                    />
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <AppText label={`Attempts: ${Number(item?.attempts) || 0}`} fontSize={11} color={colors.textTertiary} />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleRetryPendingUpload}
                                style={{ flex: 1, backgroundColor: config.THEME_COLOR, paddingVertical: 10, borderRadius: 999, alignItems: 'center' }}>
                                <AppText label="Retry now" variant={1} fontSize={13} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleEditPendingSale}
                                style={{ flex: 1, backgroundColor: colors.surfaceSecondary, paddingVertical: 10, borderRadius: 999, alignItems: 'center' }}>
                                <AppText label="Edit" variant={1} fontSize={13} color={colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleDeletePendingSale}
                                style={{ backgroundColor: colors.errorLight, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center' }}>
                                <Lucide name="trash-2" size={16} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Status Header */}
                <View style={[styles.statusHeader, { backgroundColor: item.status === 'Delivered' ? config.GREEN_COLOR : config.THEME_COLOR }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <AppText label={item.status} fontSize={20} variant={2} color={'#fff'} />
                            <AppText label={item.date} fontSize={13} color={'rgba(255,255,255,0.8)'} />
                        </View>
                        <Lucide name={item.status === 'Delivered' ? "circle-check" : "clock"} size={32} color="#fff" />
                    </View>
                    <View style={styles.divider} />
                    <AppText label={`Attendant: ${item.user}`} fontSize={13} color={'rgba(255,255,255,0.9)'} />
                </View>

                {/* Sale Summary */}
                <DetailSection title="Sale Summary">
                    <View style={styles.summaryBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15, gap: 12 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <AppText label="Transaction ID" fontSize={12} color={colors.textTertiary} />
                                <AppText
                                    label={`#${item.invoice_number}`}
                                    fontSize={18}
                                    variant={1}
                                    color={colors.text}
                                    numberOfLines={1}
                                />
                            </View>
                            <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                                <AppText label="Total Amount" fontSize={12} color={colors.textTertiary} />
                                <AppText
                                    label={formatCurrency(Number(String(item.amount ?? 0).replace(/,/g, '')) || 0)}
                                    fontSize={18}
                                    variant={1}
                                    color={config.THEME_COLOR}
                                    style={{ fontVariant: ['tabular-nums'] }}
                                />
                            </View>
                        </View>
                        <View style={styles.tagRow}>
                            <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="package" size={14} color={colors.textSecondary} />
                                <AppText label={`${item.itemCount || 0} Items`} fontSize={13} color={colors.textSecondary} style={{ marginLeft: 5 }} />
                            </View>
                            <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name={salePaymentIcon(item)} size={14} color={colors.textSecondary} />
                                <AppText
                                    label={formatSalePaymentLabel(item, { withSaleSuffix: true })}
                                    fontSize={13}
                                    color={colors.textSecondary}
                                    style={{ marginLeft: 5 }}
                                />
                            </View>
                        </View>
                    </View>
                </DetailSection>

                {/* Customer info section */}
                <DetailSection title="Customer Information">
                    <DetailRow icon="user" label="Customer Name" value={item.customer ? item.customer : 'Walk-in'} />
                    <DetailRow icon="phone" label="Contact Number" value={item.customer_phone ? formatPhone(item.customer_phone) : 'N/A'} />
                    <DetailRow icon="map-pin" label="Location" value={item.customer_address ? item.customer_address : 'N/A'} />
                    {item.customer_phone ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleCallCustomer}
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
                </DetailSection>

                {/* Payment Info */}
                <DetailSection title="Payment & Reference">
                    <DetailRow icon="hash" label="Receipt Number" value={item.payment_refrence ?? item.payment_reference ?? 'N/A'} />
                    <DetailRow icon="credit-card" label="Payment Method" value={formatSalePaymentLabel(item)} />
                    <DetailRow icon="badge-check" label="Status" value={paymentStatusLabel(item.payment_status)} />
                    <DetailRow icon="banknote" label="Amount paid" value={formatCurrency(amountPaid)} />
                    <DetailRow icon="wallet" label="Balance due" value={formatCurrency(balanceDue)} />
                    {canCollectPayment ? (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={openCollectModal}
                            style={{
                                marginTop: 12,
                                backgroundColor: config.THEME_COLOR,
                                paddingVertical: 12,
                                borderRadius: 999,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                            }}
                        >
                            <Lucide name="hand-coins" size={18} color="#fff" />
                            <AppText label="Collect payment" variant={1} fontSize={14} color="#fff" style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    ) : null}
                    {Array.isArray(item.payments) && item.payments.length > 0 ? (
                        <View style={{ marginTop: 14 }}>
                            <AppText label="Payment history" fontSize={13} variant={1} color={colors.text} style={{ marginBottom: 8 }} />
                            {item.payments.map((p) => (
                                <View
                                    key={p.id}
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        paddingVertical: 8,
                                        borderTopWidth: StyleSheet.hairlineWidth,
                                        borderTopColor: colors.border,
                                    }}
                                >
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <AppText
                                            label={`${String(p.payment_method || 'cash').toUpperCase()} · ${formatCurrency(Number(p.amount) || 0)}`}
                                            fontSize={13}
                                            color={colors.text}
                                        />
                                        <AppText
                                            label={p.created_at ? new Date(p.created_at).toLocaleString() : ''}
                                            fontSize={11}
                                            color={colors.textTertiary}
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </DetailSection>

                <DetailSection title="Sold Items">
                    {item.products?.map((prod, i) => (
                        <View key={prod.sku || prod.id || i} style={[styles.itemRow, { borderBottomColor: colors.borderLight }]}>
                            <Image
                                source={
                                    prod.thumbnail
                                        ? { uri: `${config.BASE_API}/images?id=${prod.thumbnail}` }
                                        : require('../../assets/images/product-image-placeholder.png')
                                }
                                style={[styles.itemImage, { backgroundColor: colors.surfaceTertiary }]}
                                resizeMode="cover"
                            />
                            <View style={{ flex: 1, marginLeft: 10, marginRight: 10 }}>
                                <AppText label={prod.name} fontSize={14} variant={1} color={colors.text} />
                                <AppText
                                    label={`${formatCurrency(Number(prod.unit_price) || 0)} × ${formatQuantity(prod.quantity)}`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
                                />
                            </View>
                            <AppText
                                label={formatCurrency(Number(prod.quantity || 0) * Number(prod.unit_price || 0))}
                                fontSize={14}
                                variant={1}
                                color={colors.text}
                                style={{ fontVariant: ['tabular-nums'] }}
                            />
                        </View>
                    ))}
                </DetailSection>

                {!isPendingUpload && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setShowInvoiceShare(true)}
                        style={[styles.invoiceCta, { backgroundColor: config.THEME_COLOR }]}
                    >
                        <Lucide name="send" size={18} color="#fff" />
                        <AppText label="Send invoice" variant={1} fontSize={15} color="#fff" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                )}
                {!isPendingUpload ? (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() =>
                            navigation.navigate('NewSaleReturn', {
                                saleId: saleId || item?.id,
                                item,
                            })
                        }
                        style={[
                            styles.invoiceCta,
                            {
                                backgroundColor: colors.surfaceSecondary,
                                marginTop: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Lucide name="undo-2" size={18} color={config.THEME_COLOR} />
                        <AppText label="Return items" variant={1} fontSize={15} color={config.THEME_COLOR} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                ) : null}
            </ScrollView>

            <AppModal
                title="Collect payment"
                visible={showCollectModal}
                handleClose={closeCollectModal}
                onRequestClose={closeCollectModal}
            >
                <View style={styles.collectBody}>
                <AppText label={`Balance due ${formatCurrency(balanceDue)}`} fontSize={13} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                {canUseStoreCredit ? (
                    <AppText
                        label={`Store credit available ${formatCurrency(storeCreditBalance)}`}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginBottom: 12 }}
                    />
                ) : null}
                <AppText label="Amount (GH₵)" fontSize={13} color={colors.text} style={{ marginBottom: 6 }} />
                <TextInput
                    value={collectAmount}
                    onChangeText={setCollectAmount}
                    keyboardType="decimal-pad"
                    placeholder={balanceDue.toFixed(2)}
                    placeholderTextColor={colors.placeholder}
                    editable={!momoLocked}
                    style={[collectInputStyle, momoLocked && { opacity: 0.6 }]}
                />
                <AppText label="Method" fontSize={13} color={colors.text} style={{ marginBottom: 8 }} />
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    {collectMethods.map((m) => (
                        <TouchableOpacity
                            key={m}
                            activeOpacity={0.7}
                            onPress={() => selectCollectMethod(m)}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: collectMethod === m ? config.THEME_COLOR : colors.border,
                                backgroundColor: collectMethod === m ? config.THEME_COLOR : colors.surfaceSecondary,
                            }}
                        >
                            <AppText
                                label={COLLECT_METHOD_LABELS[m]}
                                fontSize={13}
                                color={collectMethod === m ? '#fff' : colors.textSecondary}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
                {collectMethod === 'momo' ? (
                    <>
                        <AppText label="Customer MoMo number" fontSize={13} color={colors.text} style={{ marginBottom: 6 }} />
                        <TextInput
                            value={momoPhone}
                            onChangeText={(v) => {
                                setMomoPhone(v);
                                const network = MOMO_NETWORK_OPTIONS.find((n) => n.id === inferGhanaMomoNetwork(v));
                                if (network) setMomoProvider(network.provider);
                            }}
                            keyboardType="phone-pad"
                            placeholder="024 000 0000"
                            placeholderTextColor={colors.placeholder}
                            editable={!momoLocked}
                            style={[collectInputStyle, momoLocked && { opacity: 0.6 }]}
                        />
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                            {MOMO_NETWORK_OPTIONS.map((n) => (
                                <TouchableOpacity
                                    key={n.id}
                                    activeOpacity={0.7}
                                    disabled={momoLocked}
                                    onPress={() => setMomoProvider(n.provider)}
                                    style={[
                                        styles.collectChip,
                                        {
                                            borderColor: momoProvider === n.provider ? config.THEME_COLOR : colors.border,
                                            backgroundColor: momoProvider === n.provider ? `${config.THEME_COLOR}18` : colors.surfaceSecondary,
                                            opacity: momoLocked && momoProvider !== n.provider ? 0.5 : 1,
                                        },
                                    ]}
                                >
                                    <AppText
                                        label={n.label}
                                        fontSize={13}
                                        color={momoProvider === n.provider ? config.THEME_COLOR : colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        {momo.status ? (
                            <AppText
                                label={momo.status}
                                fontSize={13}
                                color={momo.paid ? colors.success || '#16a34a' : colors.textSecondary}
                                style={{ marginBottom: 8 }}
                            />
                        ) : null}
                        {momo.ref && momo.charge > momo.face + 0.001 ? (
                            <AppText
                                label={`Customer approves ${formatCurrency(momo.charge)} (includes ${formatCurrency(momo.charge - momo.face)} fee).`}
                                fontSize={12}
                                color={colors.textSecondary}
                                style={{ marginBottom: 8 }}
                            />
                        ) : null}
                        {momo.ref && !momo.paid && momo.needsOtp ? (
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                <TextInput
                                    value={momoOtp}
                                    onChangeText={setMomoOtp}
                                    keyboardType="number-pad"
                                    placeholder={isTelecelMomoProvider(momoProvider) ? 'Voucher from *110#' : 'OTP'}
                                    placeholderTextColor={colors.placeholder}
                                    style={[collectInputStyle, { flex: 1, marginBottom: 0 }]}
                                />
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    disabled={momoBusy}
                                    onPress={submitMomoOtp}
                                    style={[styles.collectSmallBtn, { backgroundColor: config.THEME_COLOR, opacity: momoBusy ? 0.6 : 1 }]}
                                >
                                    <AppText label="Submit" fontSize={13} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : null}
                        {momo.ref && !momo.paid ? (
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    disabled={momoBusy}
                                    onPress={() => checkMomoStatus()}
                                    style={[styles.collectSmallBtn, { flex: 1, borderWidth: 1, borderColor: config.THEME_COLOR, opacity: momoBusy ? 0.6 : 1 }]}
                                >
                                    <AppText label="Check status" fontSize={13} color={config.THEME_COLOR} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    disabled={momoBusy}
                                    onPress={resendMomoPrompt}
                                    style={[styles.collectSmallBtn, { flex: 1, borderWidth: 1, borderColor: colors.border, opacity: momoBusy ? 0.6 : 1 }]}
                                >
                                    <AppText label="Send again" fontSize={13} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </>
                ) : null}
                <AppText label="Note (optional)" fontSize={13} color={colors.text} style={{ marginBottom: 6 }} />
                <TextInput
                    value={collectNote}
                    onChangeText={setCollectNote}
                    placeholder="Collection note"
                    placeholderTextColor={colors.placeholder}
                    style={[collectInputStyle, { marginBottom: 16 }]}
                />
                {collectMethod === 'momo' && !momo.paid ? (
                    momo.ref ? null : (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={momoBusy}
                            onPress={() => sendMomoPrompt()}
                            style={[styles.collectPrimaryBtn, { backgroundColor: config.THEME_COLOR, opacity: momoBusy ? 0.6 : 1 }]}
                        >
                            <AppText label={momoBusy ? 'Sending…' : 'Send MoMo prompt'} variant={1} color="#fff" />
                        </TouchableOpacity>
                    )
                ) : (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={savingCollect}
                        onPress={() => saveCollectPayment()}
                        style={[styles.collectPrimaryBtn, { backgroundColor: config.THEME_COLOR, opacity: savingCollect ? 0.6 : 1 }]}
                    >
                        <AppText label={savingCollect ? 'Saving…' : 'Record payment'} variant={1} color="#fff" />
                    </TouchableOpacity>
                )}
                </View>
                {showCollectModal ? dialogs : null}
            </AppModal>
            {!showCollectModal ? dialogs : null}

            <InvoiceShareSheet
                visible={showInvoiceShare}
                sale={item}
                saleId={saleId || item?.id}
                appSettings={appSettings}
                onClose={() => setShowInvoiceShare(false)}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    collectBody: { paddingHorizontal: 16, paddingTop: 14 },
    collectChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    collectSmallBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    collectPrimaryBtn: { paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
    headerActionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusHeader: {
        padding: 20,
        borderRadius: 5,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginVertical: 15,
    },
    section: {
        borderRadius: 5,
        padding: 15,
        marginBottom: 15,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    sectionTitle: {
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    itemImage: {
        width: 40,
        height: 40,
        borderRadius: 8,
        overflow: 'hidden',
    },
    invoiceCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 999,
        marginBottom: 24,
    },
});

export default SaleDetails;