import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import ScreenHeader from '../../components/screen_header';
import { useSelector } from 'react-redux';
import { subscriptions as subscriptionsApi, billing as billingApi } from '../../services/api';
import { buildPlansFromCatalog } from '../../utils/billingCatalog';
import { setSubscriptionActive } from '../../store/actions/appSettings';
import { canManageSubscription } from '../../utils/permissions';
import { SUBSCRIPTION_INACTIVE_MESSAGE } from '../../utils/subscriptionAccess';
import { CHOOSEABLE_SUBSCRIPTION_PLANS, PLAN_RANK_BY_NAME } from '../../constants/subscriptionPlans';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

function normalizeStatus(status) {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'active';
    if (s === 'expired' || s === 'cancelled' || s === 'inactive') return 'expired';
    if (s === 'pending') return 'pending';
    return 'trial';
}

const Subscription = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const user = useSelector((state) => state.user);
    const subscriptionFeatures = useSelector((state) => state.appSettings?.subscriptionFeatures || []);
    const requiredPayment = route?.params?.requiredPayment === true;
    const scrollToPlans = route?.params?.scrollToPlans === true;
    const scrollRef = useRef(null);
    const [plansOffsetY, setPlansOffsetY] = useState(0);
    const allowManage = requiredPayment || canManageSubscription(user, subscriptionFeatures);

    const [loading, setLoading] = useState(true);
    const [subscriptionStatus, setSubscriptionStatus] = useState('expired'); // 'active', 'expired', 'trial'
    const [planName, setPlanName] = useState('Premium');
    const [nextBillingDate, setNextBillingDate] = useState('');
    const [amount, setAmount] = useState(0);
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly', 'yearly'
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [subscriptionId, setSubscriptionId] = useState(null);
    const [onboarding, setOnboarding] = useState(false);
    const [chooseError, setChooseError] = useState(null);
    const [catalogPlans, setCatalogPlans] = useState(null);

    const loadSubscription = useCallback(async () => {
        setLoading(true);
        try {
            const [subResponse, cat] = await Promise.all([
                subscriptionsApi.current(),
                billingApi.catalog({ grouped: true }).catch(() => null),
            ]);
            // Prefer hardcoded paid amounts; only overlay catalog prices when they are > 0
            // (Railway restores often leave billing_catalog_items.amount_ghs at 0).
            const fromCat = buildPlansFromCatalog(cat) || [];
            const merged = CHOOSEABLE_SUBSCRIPTION_PLANS.map((base) => {
                const row = fromCat.find((p) => p.v === base.key);
                const catalogAmount = row != null ? Number(row.monthlyGhs) : NaN;
                return {
                    ...base,
                    amount: Number.isFinite(catalogAmount) && catalogAmount > 0 ? catalogAmount : base.amount,
                    description: base.description,
                    features: base.features,
                };
            });
            setCatalogPlans(merged);
            const sub = subResponse?.subscription;
            // console.log('sub', sub);
            const status = normalizeStatus(sub?.status ?? sub?.state);
            // console.log('x status', status);
            setSubscriptionStatus(status);
            if (sub?.name) setPlanName(sub.name);
            if (sub?.end_at) setNextBillingDate(sub.end_at);
            if (sub?.amount != null) setAmount(Number(sub.amount));
            if (sub?.billing_interval) setBillingCycle(sub.billing_interval);
            setSubscriptionId(sub?.id ?? null);
            const history = subResponse?.recentPayments;
            console.log('history', history);
            if (Array.isArray(history)) setPaymentHistory(history.slice(0, 10));
            if (status === 'active') dispatch(setSubscriptionActive(true));
        } catch (_) {
            setSubscriptionStatus('expired');
            setPaymentHistory([]);
            setCatalogPlans(CHOOSEABLE_SUBSCRIPTION_PLANS);
        } finally {
            setLoading(false);
        }
    }, [requiredPayment]);

    useEffect(() => { loadSubscription(); }, [loadSubscription]);

    // Refetch when screen gains focus. Do not depend on `loading` or the callback
    // changes when loading toggles and can prevent setLoading(false) from ever running.
    useFocusEffect(
        useCallback(() => {
            loadSubscription();
        }, [loadSubscription])
    );

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCurrency = (value) => formatter.format(value).replace('GH₵', 'GHS ').trim();

    const getStatusColor = () => {
        if (subscriptionStatus === 'active') return '#10b981';
        if (subscriptionStatus === 'expired') return '#ef4444';
        return '#f59e0b';
    };

    const getStatusLabel = () => {
        // console.log('subscriptionStatus', subscriptionStatus);
        if (subscriptionStatus === 'active') return 'Active';
        if (subscriptionStatus === 'expired') return 'Expired';
        if (subscriptionStatus === 'pending') return 'Pending';
        return 'Trial';
    };

    const subscriptionActive = subscriptionStatus === 'active';
    const hasSubscription = Boolean(subscriptionId);
    const currentRank = PLAN_RANK_BY_NAME[planName] ?? 0;
    const selectablePlans = useMemo(() => {
        const source = (catalogPlans?.length ? catalogPlans : CHOOSEABLE_SUBSCRIPTION_PLANS).map((plan) => {
            const fallback = CHOOSEABLE_SUBSCRIPTION_PLANS.find((p) => p.key === plan.key);
            const amount = Number(plan.amount);
            return {
                ...plan,
                amount: Number.isFinite(amount) && amount > 0 ? amount : (fallback?.amount ?? 0),
                billing: plan.billing || 'Monthly',
                features: plan.features?.length ? plan.features : (fallback?.features || []),
                description: plan.description || fallback?.description || '',
            };
        });
        if (currentRank > 0) {
            return source.filter((p) => p.key > currentRank);
        }
        return source;
    }, [catalogPlans, currentRank]);

    const showUpgradeSection =
        hasSubscription && selectablePlans.length > 0 && (subscriptionActive || currentRank > 0);

    useEffect(() => {
        if (!scrollToPlans || loading || plansOffsetY <= 0) return;
        const timer = setTimeout(() => {
            scrollRef.current?.scrollTo({ y: Math.max(0, plansOffsetY - 12), animated: true });
        }, 350);
        return () => clearTimeout(timer);
    }, [scrollToPlans, loading, plansOffsetY, hasSubscription, showUpgradeSection]);

    const navigateToCheckout = (created, selectedPlan) => {
        const params = {
            flowType: 'subscription',
            amount: Number(created?.amount ?? selectedPlan?.amount ?? amount) || 0,
            planName: selectedPlan?.name || created?.name || planName,
            billingCycle: created?.billing_interval || billingCycle,
            nextBillingDate: created?.end_at || nextBillingDate,
            subscriptionId: created?.id || subscriptionId,
        };
        if (created?.is_upgrade && Number(created?.upgrade_bonus_days) > 0) {
            params.upgradeBonusDays = created.upgrade_bonus_days;
            if (created.upgrade_credit_value_ghs != null) {
                params.upgradeCreditGhs = created.upgrade_credit_value_ghs;
            }
        }
        navigation.navigate('Payment', params);
    };

    const handleChoosePlan = async (subscription_type) => {
        setChooseError(null);
        setOnboarding(true);
        try {
            const created = await subscriptionsApi.onboard({ subscription_type });
            const selectedPlan = CHOOSEABLE_SUBSCRIPTION_PLANS.find((p) => p.key === subscription_type);
            await loadSubscription();
            navigateToCheckout(created, selectedPlan);
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Could not start subscription checkout. Please try again.';
            setChooseError(msg);
            Alert.alert('Subscription', msg);
        } finally {
            setOnboarding(false);
        }
    };

    const handleMakePayment = () => {
        if (!navigation?.navigate) return;
        navigation.navigate('Payment', {
            flowType: 'subscription',
            amount,
            planName,
            billingCycle,
            nextBillingDate,
            subscriptionId,
        });
    };

    const handleViewInvoice = (paymentItem) => {
        if (navigation?.navigate) navigation.navigate('PaymentInvoice', { payment: paymentItem, planName });
    };

    const handleViewAllHistory = () => {
        if (navigation?.navigate) navigation.navigate('PaymentHistory');
    };

    const headerLabel = requiredPayment ? 'Subscription required' : 'Subscription & Payment';
    const headerOnPress = () => {
        if (requiredPayment && route?.params?.onGoBack) {
            route.params.onGoBack();
        } else if (navigation?.goBack) {
            navigation.goBack();
        }
    };

    if (!allowManage) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
                <AppText label="You do not have access to manage subscription billing." fontSize={15} color={colors.textSecondary} style={{ paddingHorizontal: 24, textAlign: 'center' }} />
                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
                    <AppText label="Back to profile" fontSize={15} color={config.THEME_COLOR} variant={1} />
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading subscription..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    return (
        <View style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader
                label={headerLabel}
                onPress={headerOnPress}
            />
            <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
                showsVerticalScrollIndicator={false}>
                {!subscriptionActive ? (
                    <View style={[styles.inactiveBanner, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                        <Lucide name="triangle-alert" size={20} color="#b45309" />
                        <AppText
                            label={SUBSCRIPTION_INACTIVE_MESSAGE}
                            fontSize={14}
                            color="#92400e"
                            variant={1}
                            style={{ marginLeft: 10, flex: 1 }}
                        />
                    </View>
                ) : null}

                {/* Subscription Status Card */}
                <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.statusHeader}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                            <AppText label={getStatusLabel()} fontSize={12} variant={1} color={getStatusColor()} style={{ marginLeft: 6 }} />
                        </View>
                        <Lucide name="credit-card" size={24} color={config.THEME_COLOR} />
                    </View>
                    <AppText label={planName} variant={1} fontSize={22} color={colors.text} style={{ marginTop: 12 }} />
                    <AppText label={`${formatCurrency(amount)}/${billingCycle === 'monthly' ? 'month' : 'year'}`} fontSize={16} color={colors.textSecondary} style={{ marginTop: 4 }} />
                    {subscriptionStatus === 'active' && (
                        <View style={styles.nextBillingRow}>
                            <Lucide name="calendar" size={16} color={colors.textTertiary} />
                            <AppText label={`Next billing: ${formatDate(nextBillingDate)}`} fontSize={13} color={colors.textTertiary} style={{ marginLeft: 6 }} />
                        </View>
                    )}
                </View>

                {chooseError ? (
                    <View style={[styles.infoBanner, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
                        <Lucide name="alert-circle" size={18} color="#ef4444" />
                        <AppText label={chooseError} fontSize={13} color="#991b1b" style={{ marginLeft: 10, flex: 1 }} />
                    </View>
                ) : null}

                {!hasSubscription ? (
                    <View
                        style={styles.section}
                        onLayout={(e) => {
                            if (scrollToPlans) setPlansOffsetY(e.nativeEvent.layout.y);
                        }}>
                        <AppText label="Choose a subscription plan" variant={1} fontSize={16} color={colors.text} style={styles.sectionTitle} />
                        <AppText
                            label="No subscription is linked yet. Select a plan to continue and proceed to payment."
                            fontSize={13}
                            color={colors.textSecondary}
                            style={{ marginBottom: 12 }}
                        />
                        {CHOOSEABLE_SUBSCRIPTION_PLANS.map((plan) => (
                            <View
                                key={plan.key}
                                style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <AppText label={plan.name} variant={1} fontSize={17} color={colors.text} />
                                <AppText label={plan.description} fontSize={13} color={colors.textSecondary} style={{ marginTop: 4 }} />
                                {(plan.features || []).map((line) => (
                                    <AppText
                                        key={line}
                                        label={`• ${line}`}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 6 }}
                                    />
                                ))}
                                <View style={styles.planCardFooter}>
                                    <AppText
                                        label={`GHS ${plan.amount} / ${plan.billing.toLowerCase()}`}
                                        variant={1}
                                        fontSize={15}
                                        color={config.THEME_COLOR}
                                    />
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        disabled={onboarding}
                                        onPress={() => handleChoosePlan(plan.key)}
                                        style={[styles.planActionBtn, { backgroundColor: config.THEME_COLOR }]}>
                                        {onboarding ? (
                                            <ActivityIndicator size="small" color={colors.textInverse} />
                                        ) : (
                                            <AppText label="Choose" variant={1} fontSize={14} color={colors.textInverse} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <>
                        {!subscriptionActive && (subscriptionStatus === 'expired' || subscriptionStatus === 'pending') ? (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleMakePayment}
                                style={[styles.payButton, { backgroundColor: subscriptionStatus === 'expired' ? '#ef4444' : config.THEME_COLOR }]}>
                                <Lucide name="credit-card" size={20} color={colors.textInverse} />
                                <AppText
                                    label={subscriptionStatus === 'expired' ? 'Renew subscription' : 'Complete payment'}
                                    variant={1}
                                    fontSize={16}
                                    color={colors.textInverse}
                                    style={{ marginLeft: 8 }}
                                />
                            </TouchableOpacity>
                        ) : null}

                        {showUpgradeSection ? (
                            <View
                                style={styles.section}
                                onLayout={(e) => {
                                    if (scrollToPlans) setPlansOffsetY(e.nativeEvent.layout.y);
                                }}>
                                <View style={[styles.infoBanner, { backgroundColor: colors.primaryShade, borderColor: colors.border }]}>
                                    <Lucide name="info" size={18} color={config.THEME_COLOR} />
                                    <AppText
                                        label={`Upgrading adds the value of your remaining ${planName} days as extra time on the new plan after payment (prorated). Your current plan stays active until checkout completes.`}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginLeft: 10, flex: 1 }}
                                    />
                                </View>
                                <AppText label="Upgrade plan" variant={1} fontSize={16} color={colors.text} style={styles.sectionTitle} />
                                {selectablePlans.map((plan) => (
                                    <View
                                        key={plan.key}
                                        style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                        <AppText label={plan.name} variant={1} fontSize={17} color={colors.text} />
                                        <AppText label={plan.description} fontSize={13} color={colors.textSecondary} style={{ marginTop: 4 }} />
                                        {(plan.features || []).map((line) => (
                                            <AppText
                                                key={line}
                                                label={`• ${line}`}
                                                fontSize={12}
                                                color={colors.textSecondary}
                                                style={{ marginTop: 6 }}
                                            />
                                        ))}
                                        <View style={styles.planCardFooter}>
                                            <AppText
                                                label={`GHS ${plan.amount} / ${plan.billing.toLowerCase()}`}
                                                variant={1}
                                                fontSize={15}
                                                color={config.THEME_COLOR}
                                            />
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                disabled={onboarding}
                                                onPress={() => handleChoosePlan(plan.key)}
                                                style={[styles.planActionBtn, { backgroundColor: config.THEME_COLOR }]}>
                                                {onboarding ? (
                                                    <ActivityIndicator size="small" color={colors.textInverse} />
                                                ) : (
                                                    <AppText label="Upgrade" variant={1} fontSize={14} color={colors.textInverse} />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        {hasSubscription && subscriptionActive && selectablePlans.length === 0 ? (
                            <AppText
                                label="You are on the highest plan. Contact support for custom arrangements."
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ marginBottom: 16 }}
                            />
                        ) : null}
                    </>
                )}

                {/* Payment History */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <AppText label="Payment History" variant={1} fontSize={16} color={colors.text} />
                        {paymentHistory.length > 0 && (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleViewAllHistory}
                                style={styles.viewAllButton}>
                                <AppText label="View All" fontSize={14} color={config.THEME_COLOR} />
                                <Lucide name="chevron-right" size={16} color={config.THEME_COLOR} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {paymentHistory.length === 0 ? (
                            <View style={styles.emptyHistory}>
                                <Lucide name="wallet" size={40} color={colors.border} />
                                <AppText label="No payment history" fontSize={14} color={colors.textTertiary} style={{ marginTop: 12 }} />
                            </View>
                        ) : (
                            paymentHistory.slice(0, 3).map((payment, index) => {
                                const pId = payment.id ?? payment.invoiceId ?? String(index);
                                const pDate = payment.date ?? payment.paymentDate ?? payment.created_at ?? '';
                                const pAmount = payment.amount ?? payment.total ?? 0;
                                const pStatus = (payment.status ?? payment.paymentStatus ?? 'paid').toLowerCase();
                                const pMethod = payment.payment_method_type ? payment.payment_method_type.toLowerCase().includes('mobile') ? 'Mobile money' : 'Card' : '-';
                                return (
                                    <TouchableOpacity
                                        key={pId}
                                        activeOpacity={0.6}
                                        onPress={() => handleViewInvoice(payment)}
                                        style={[styles.paymentRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                                        <View style={styles.paymentLeft}>
                                            <View style={[styles.paymentIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                                <Lucide name="wallet" size={18} color={config.THEME_COLOR} />
                                            </View>
                                            <View style={{ marginLeft: 12 }}>
                                                <AppText label={pDate ? formatDate(pDate) : '—'} variant={2} fontSize={15} color={colors.text} />
                                                <AppText label={pMethod} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                            </View>
                                        </View>
                                        <View style={styles.paymentRight}>
                                            <AppText label={formatCurrency(pAmount)} variant={1} fontSize={16} color={colors.text} />
                                            <View style={[styles.paidBadge, { backgroundColor: pStatus === 'paid' ? '#dcfce7' : '#fef3c7' }]}>
                                                <AppText label={(payment.status ?? pStatus).toUpperCase()} fontSize={10} variant={2} color={pStatus === 'paid' ? '#10b981' : '#f59e0b'} />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                </View>

                {/* Plan Details */}
                <View style={styles.section}>
                    <AppText label="Plan Details" variant={1} fontSize={16} color={colors.text} style={styles.sectionTitle} />
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.detailRow}>
                            <AppText label="Plan" fontSize={14} color={colors.textSecondary} />
                            <AppText label={planName} variant={2} fontSize={14} color={colors.text} />
                        </View>
                        <View style={[styles.detailDivider, { backgroundColor: colors.divider }]} />
                        <View style={styles.detailRow}>
                            <AppText label="Billing Cycle" fontSize={14} color={colors.textSecondary} />
                            <AppText label={billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} variant={2} fontSize={14} color={colors.text} />
                        </View>
                        <View style={[styles.detailDivider, { backgroundColor: colors.divider }]} />
                        <View style={styles.detailRow}>
                            <AppText label="Amount" fontSize={14} color={colors.textSecondary} />
                            <AppText label={formatCurrency(amount)} variant={2} fontSize={14} color={colors.text} />
                        </View>
                        {subscriptionStatus === 'active' && (
                            <>
                                <View style={[styles.detailDivider, { backgroundColor: colors.divider }]} />
                                <View style={styles.detailRow}>
                                    <AppText label="Next Billing" fontSize={14} color={colors.textSecondary} />
                                    <AppText label={formatDate(nextBillingDate)} variant={2} fontSize={14} color={colors.text} />
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
    statusCard: {
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
    },
    statusHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    nextBillingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 12,
        marginBottom: 16,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
    },
    inactiveBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
    },
    planCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    planCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    planActionBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 88,
        alignItems: 'center',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        marginBottom: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionCard: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
    },
    emptyHistory: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    paymentLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    paymentIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paymentRight: {
        alignItems: 'flex-end',
    },
    paidBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    detailDivider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 16,
    },
});

export default Subscription;
