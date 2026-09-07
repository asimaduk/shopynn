import React, { useState, useCallback } from 'react';
import { Image, StyleSheet, TouchableOpacity, ScrollView, View, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import useTheme from '../../hooks/useTheme';
import { useFocusEffect } from '@react-navigation/native';
import { users as usersApi, sales as salesApi, customerProfiles, subscriptions as subscriptionsApi } from '../../services/api';
import { canManageSubscription } from '../../utils/permissions';
import {
    isTenantSubscriptionActive,
    SUBSCRIPTION_INACTIVE_MESSAGE,
} from '../../utils/subscriptionAccess';
import { formatCurrency } from '../../utils/format';
import { useDispatch, useSelector } from 'react-redux';
import { SET_USER } from '../../store/actions/user';

const { width } = Dimensions.get('screen');

const Profile = ({ navigation, route }) => {
    const dispatch = useDispatch();
    const reduxUser = useSelector((state) => state.user) || {};
    const { colors } = useTheme();
    const appSettings = useSelector((state) => state.appSettings) || {};
    const reduxMerchantId = useSelector((state) => state.user?.merchant_id);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showFullImage, setShowFullImage] = useState(false);
    const [myWeeklySalesCount, setMyWeeklySalesCount] = useState(0);
    const [myWeeklySalesTotal, setMyWeeklySalesTotal] = useState(0);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageActionLoading, setImageActionLoading] = useState(null); // 'upload' | 'delete' | null
    const [linkedStores, setLinkedStores] = useState([]);
    const [billingSub, setBillingSub] = useState(null);
    const [billingPayments, setBillingPayments] = useState([]);
    const [billingLoading, setBillingLoading] = useState(false);

    const getThisWeekDateParams = () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // Week starts Monday
        const day = today.getDay(); // 0=Sun,1=Mon,...6=Sat
        const diffToMonday = (day + 6) % 7;
        const start = new Date(today);
        start.setDate(start.getDate() - diffToMonday);
        const end = new Date(today.getTime() + 24 * 60 * 60 * 1000); // tomorrow (exclusive-ish)
        return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    };

    const loadProfile = useCallback(() => {
        let mounted = true;
        setLoading(true);
        Promise.allSettled([usersApi.me()])
            .then((results) => {
                const meRes = results?.[0];

                const me = meRes?.status === 'fulfilled' ? meRes.value : null;

                if (!mounted) return;

                if (me) setProfile(me);
                const imageUrl =
                    me?.profile_image ??
                    me?.profileImage ??
                    me?.avatar ??
                    null;

                setSelectedImage((prev) => {
                    if (prev?.isLocal) return prev;
                    if (imageUrl) return { uri: imageUrl, isLocal: false };
                    return prev;
                });

                const roleNames = Array.isArray(me?.settings?.roles)
                    ? me.settings.roles.map((role) => String(role?.name || '').trim().toLowerCase()).filter(Boolean)
                    : [];
                const isCustomer = roleNames.includes('customer');
                const isMerchant = Boolean(me?.merchant_id);
                if (isCustomer) {
                    customerProfiles
                        .stores()
                        .then((stores) => {
                            if (!mounted) return;
                            setLinkedStores(Array.isArray(stores) ? stores : []);
                        })
                        .catch(() => {
                            if (!mounted) return;
                            setLinkedStores([]);
                        });
                    setMyWeeklySalesCount(0);
                    setMyWeeklySalesTotal(0);
                } else if (isMerchant) {
                    setMyWeeklySalesCount(0);
                    setMyWeeklySalesTotal(0);
                } else {
                    salesApi
                        .mtdSales()
                        .then((res) => {
                            if (!mounted) return;
                            const count = Number(res?.transactionsCount ?? 0);
                            setMyWeeklySalesCount(Number.isFinite(count) ? count : 0);

                            const totalSales = Number(res?.totalSales ?? 0);
                            setMyWeeklySalesTotal(Number.isFinite(totalSales) ? totalSales : 0);
                        })
                        .catch(() => {
                            if (!mounted) return;
                            setMyWeeklySalesCount(0);
                        });
                }
            })
            .catch(() => {})
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            const cleanup = loadProfile();
            return () => {
                if (typeof cleanup === 'function') {
                    cleanup();
                }
            };
        }, [loadProfile]),
    );

    const subscriptionActive = appSettings?.subscriptionActive !== false;
    const subscriptionInactive =
        !subscriptionActive ||
        (profile?.company?.subscription
            ? !isTenantSubscriptionActive(profile.company.subscription)
            : false);
    const subscriptionFeatures = useSelector((state) => state.appSettings?.subscriptionFeatures || []);
    const showBilling = canManageSubscription(reduxUser, subscriptionFeatures, {
        allowWhenSubscriptionExpired: subscriptionInactive,
    });

    const loadBilling = useCallback(async () => {
        if (!canManageSubscription(reduxUser, subscriptionFeatures, { allowWhenSubscriptionExpired: subscriptionInactive })) return;
        setBillingLoading(true);
        try {
            const res = await subscriptionsApi.current({ payments_limit: 10 });
            setBillingSub(res?.subscription ?? null);
            setBillingPayments(Array.isArray(res?.recentPayments) ? res.recentPayments : []);
        } catch (_) {
            setBillingSub(null);
            setBillingPayments([]);
        } finally {
            setBillingLoading(false);
        }
    }, [reduxUser, subscriptionFeatures, subscriptionInactive]);

    useFocusEffect(
        useCallback(() => {
            if (!showBilling) return undefined;
            loadBilling();
            return undefined;
        }, [showBilling, loadBilling]),
    );

    const backPress = () => {
        navigation.goBack();
    }

    const handleRemoveImage = () => {
        setSelectedImage({ uri: null });
        setShowFullImage(false);
    }

    const handleOpenGallery = async () => {
        const result = await launchImageLibrary({ mediaType: 'photo', maxHeight: 400, maxWidth: 400 });
        if (result.assets && result.assets.length > 0) {
            setSelectedImage({ isLocal: true, ...result.assets[0] });
        }
    }

    const handleOpenCamera = async () => {
        const result = await launchCamera({ mediaType: 'photo', maxHeight: 400, maxWidth: 400, quality: .7, cameraType: 'back' });
        if (result.assets && result.assets.length > 0) {
            setSelectedImage({ isLocal: true, ...result.assets[0] });
        }
    }

    const handleUploadImage = async () => {
        if (!selectedImage) return;
        setImageActionLoading('upload');
        try {
            const res = await usersApi.updateProfileImage(selectedImage);
            const uploadedImageUrl = res?.image_url || selectedImage?.uri || null;
            Alert.alert('Success', 'Image uploaded successfully');
            setShowFullImage(false);
            setSelectedImage({ uri: uploadedImageUrl, isLocal: false });
            dispatch({
                type: SET_USER,
                payload: {
                    ...reduxUser,
                    profile_image: uploadedImageUrl,
                    profileImage: uploadedImageUrl,
                    avatar: uploadedImageUrl,
                },
            });
        } catch (_) {
            Alert.alert('Error', 'Failed to upload image');
        } finally {
            setImageActionLoading(null);
        }
    }

    const handleAddImage = async () => {
        Alert.alert('Profile Photo', 'Choose an option', [
            { text: 'Gallery', onPress: handleOpenGallery },
            { text: 'Camera', onPress: handleOpenCamera },
            { text: 'Cancel', style: 'cancel' }
        ])
    }

    const handleDeleteImage = async () => {
        if (!selectedImage) return;
        if (selectedImage.isLocal) return;

        Alert.alert(
            'Delete Profile Image',
            'Are you sure you want to delete your profile image?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setImageActionLoading('delete');
                        try {
                            await usersApi.removeProfileImage();
                            Alert.alert('Success', 'Image deleted successfully');
                            setShowFullImage(false);
                            setSelectedImage(null);
                            dispatch({
                                type: SET_USER,
                                payload: {
                                    ...reduxUser,
                                    profile_image: null,
                                    profileImage: null,
                                    avatar: null,
                                },
                            });
                        } catch (_) {
                            console.log('error', _);
                            Alert.alert('Error', 'Failed to delete image');
                        } finally {
                            setImageActionLoading(null);
                        }
                    },
                },
            ],
        );
    }

    const InfoRow = ({ icon, label, val }) => (
        <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, { backgroundColor: colors.surfaceSecondary }]}>
                <Lucide name={icon} size={18} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
                <AppText label={label} fontSize={12} color={colors.textTertiary} />
                <AppText label={val} fontSize={15} color={colors.text} variant={1} style={{ marginTop: 2 }} />
            </View>
        </View>
    );

    const StatItem = ({ label, value, icon, color }) => (
        <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
                <Lucide name={icon} size={20} color={color} />
            </View>
            <AppText label={value} variant={1} fontSize={18} color={colors.text} style={{ marginTop: 8 }} />
            <AppText label={label} fontSize={12} color={colors.textTertiary} />
        </View>
    );

    const name = profile?.first_name + ' ' + profile?.last_name || '—';
    const email = profile?.email || '—';
    const phone = profile?.phone || '—';
    const branch = profile?.warehouse_name || profile?.location || '—';
    const companyName = profile?.companyName || appSettings?.companyName || appSettings?.receiptCompanyName || 'Shopynn';
    const companyIndustry = profile?.company?.industry || '—';

    const roles = profile?.settings?.roles?.map((role) => role.name).join(', ') || '—';
    const roleNames = Array.isArray(profile?.settings?.roles)
        ? profile.settings.roles.map((role) => String(role?.name || '').trim().toLowerCase()).filter(Boolean)
        : [];
    const isCustomerProfile = roleNames.includes('customer');
    const companyAddress = appSettings?.companyAddress || '—';
    const companyPhone = appSettings?.companyPhone || '—';
    const companyEmail = appSettings?.companyEmail || '—';
    const planName = appSettings?.subscriptionPlan?.name || '—';
    const isMerchantProfile = Boolean(profile?.merchant_id ?? reduxMerchantId);
    const linkedStoreName = linkedStores?.[0]?.name || linkedStores?.[0]?.warehouse_name || linkedStores?.[0]?.warehouse_id || '—';
    const linkedStoreRef = linkedStores?.[0]?.reference_code || linkedStores?.[0]?.store_reference || null;
    const resolveProfileImageUri = (raw) => {
        const value = String(raw || '').trim();
        if (!value) return '';
        if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
        return `${config.BASE_API}/images?id=${encodeURIComponent(value)}`;
    };
    const avatarUri = resolveProfileImageUri(selectedImage?.uri);

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading profile..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'My Profile'}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
                    <TouchableOpacity
                        activeOpacity={.6}
                        onPress={() => navigation.navigate("ResetPassword", { changePassword: false })}
                        style={[styles.headerAction, { backgroundColor: colors.surfaceSecondary }]}>
                        <Lucide name="lock" color={colors.textSecondary} size={18} />
                    </TouchableOpacity>
                    
                    {/* TODO: Add edit profile button */}
                    {/* <TouchableOpacity
                        activeOpacity={.6}
                        onPress={() => navigation.navigate("ProfileForm", { profile })}
                        style={[styles.headerAction, { marginLeft: 10, backgroundColor: colors.surfaceSecondary }]}>
                        <Lucide name="pencil" color={colors.textSecondary} size={18} />
                    </TouchableOpacity> */}
                </View>
            </ScreenHeader>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {subscriptionInactive ? (
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

                {/* Profile Header Card */}
                <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.imageSection}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => setShowFullImage(true)}
                            style={[styles.avatarWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Image
                                source={avatarUri ? { uri: avatarUri } : require('../../assets/images/dp.png')}
                                style={styles.avatar}
                            />
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleAddImage}
                                style={[styles.cameraBtn, { borderColor: colors.surface }]}>
                                <Lucide name="camera" color={colors.textInverse} size={14} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.nameSection}>
                        <AppText label={name} variant={1} fontSize={24} color={colors.text} />
                        {!isCustomerProfile ? (
                            <View style={[styles.companyBadge, { backgroundColor: config.THEME_COLOR + '10' }]}>
                                <Lucide name="building-2" size={14} color={config.THEME_COLOR} />
                                <AppText label={companyName} fontSize={13} color={config.THEME_COLOR} variant={1} style={{ marginLeft: 6 }} numberOfLines={1} />
                            </View>
                        ) : (
                            <View style={[styles.companyBadge, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="user-round" size={14} color={colors.textSecondary} />
                                <AppText label="Customer account" fontSize={13} color={colors.textSecondary} variant={1} style={{ marginLeft: 6 }} numberOfLines={1} />
                            </View>
                        )}
                    </View>

                    {/* Stats Section */}
                    <View style={styles.statsContainer}>
                        <StatItem label="Role" value={String(roles)} icon="id-card" color={colors.info} />
                        {!isMerchantProfile && !isCustomerProfile ? (
                            <>
                                <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
                                <StatItem value="Sales (MTD)" label={`${myWeeklySalesCount} (${formatCurrency(myWeeklySalesTotal)})`} icon="shopping-cart" color={colors.success} />
                            </>
                        ) : null}
                        <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
                        <StatItem label="Plan" value={planName} icon="wallet" color={colors.warning} />
                    </View>
                </View>

                {/* Contact Information Section */}
                <View style={styles.section}>
                    <AppText label="CONTACT INFORMATION" variant={1} fontSize={13} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.card, { backgroundColor: colors.surface }]}>
                        <InfoRow icon="phone" label="Phone" val={phone} />
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <InfoRow icon="mail" label="Email" val={email} />
                    </View>
                </View>

                {/* Location Section */}
                {!isCustomerProfile && (
                    <View style={styles.section}>
                        <AppText label="ASSIGNED LOCATION" variant={1} fontSize={13} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.card, { backgroundColor: colors.surface }]}>
                            <InfoRow icon="store" label="Branch" val={branch} />
                        </View>
                    </View>
                )}
                {isCustomerProfile && (
                    <View style={styles.section}>
                        <AppText label="ATTACHED STORE" variant={1} fontSize={13} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.card, { backgroundColor: colors.surface }]}>
                            <InfoRow icon="store" label="Store / Company" val={linkedStoreName} />
                            {linkedStoreRef ? (
                                <>
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                    <InfoRow icon="hash" label="Reference" val={String(linkedStoreRef)} />
                                </>
                            ) : null}
                        </View>
                    </View>
                )}

                {showBilling && !isCustomerProfile ? (
                    <View style={styles.section}>
                        <AppText
                            label="SUBSCRIPTION & BILLING"
                            variant={1}
                            fontSize={13}
                            color={colors.textTertiary}
                            style={styles.sectionTitle}
                        />
                        <View style={[styles.card, { backgroundColor: colors.surface }]}>
                            {billingLoading ? (
                                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={config.THEME_COLOR} />
                                </View>
                            ) : (
                                <>
                                    <InfoRow
                                        icon="credit-card"
                                        label="Plan"
                                        val={billingSub?.name || planName || '—'}
                                    />
                                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                    <InfoRow
                                        icon="circle-check"
                                        label="Status"
                                        val={String(billingSub?.status || '—')}
                                    />
                                    {billingSub?.end_at ? (
                                        <>
                                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                            <InfoRow
                                                icon="calendar"
                                                label="Next billing"
                                                val={new Date(billingSub.end_at).toLocaleDateString('en-GB', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            />
                                        </>
                                    ) : null}
                                    {billingPayments.length > 0 ? (
                                        <>
                                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                            <InfoRow
                                                icon="clock"
                                                label="Latest payment"
                                                val={`GHS ${Number(billingPayments[0]?.amount || 0).toFixed(2)} · ${String(
                                                    billingPayments[0]?.status || '—',
                                                )}`}
                                            />
                                        </>
                                    ) : null}
                                </>
                            )}
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate('Subscription')}
                                style={styles.billingActionRow}
                            >
                                <Lucide name="wallet" size={18} color={config.THEME_COLOR} />
                                <AppText
                                    label="Manage subscription"
                                    fontSize={15}
                                    color={config.THEME_COLOR}
                                    variant={1}
                                    style={{ marginLeft: 10, flex: 1 }}
                                />
                                <Lucide name="chevron-right" size={18} color={colors.border} />
                            </TouchableOpacity>
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate('PaymentHistory')}
                                style={styles.billingActionRow}
                            >
                                <Lucide name="history" size={18} color={config.THEME_COLOR} />
                                <AppText
                                    label="View previous payments"
                                    fontSize={15}
                                    color={config.THEME_COLOR}
                                    variant={1}
                                    style={{ marginLeft: 10, flex: 1 }}
                                />
                                <Lucide name="chevron-right" size={18} color={colors.border} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}

                {/* Company Profile Section */}
                {!isCustomerProfile && (
                    <View style={styles.section}>
                        <AppText label="COMPANY PROFILE" variant={1} fontSize={13} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.card, { backgroundColor: colors.surface }]}>
                            <InfoRow icon="building-2" label="Company name" val={companyName} />
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <InfoRow icon="map-pin" label="Address" val={companyAddress} />
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <InfoRow icon="phone" label="Company phone" val={companyPhone} />
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <InfoRow icon="mail" label="Company email" val={companyEmail} />
                            {/* <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <InfoRow icon="briefcase" label="Industry" val={companyIndustry} /> */}
                        </View>
                    </View>
                )}
            </ScrollView>

            <AppModal
                title={'Profile Photo'}
                handleClose={() => {
                    if (imageActionLoading) return;
                    setShowFullImage(false);
                }}
                onRequestClose={() => {
                    if (imageActionLoading) return;
                    setShowFullImage(false);
                }}
                visible={showFullImage}>
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <View style={[styles.fullImageWrapper, { borderColor: colors.surface }]}>
                        <Image
                            source={avatarUri ? { uri: avatarUri } : require('../../assets/images/dp.png')}
                            style={styles.fullImage}
                            resizeMode='cover'
                        />
                    </View>
                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            activeOpacity={.6}
                            disabled={!!imageActionLoading}
                            onPress={selectedImage && selectedImage.isLocal ? handleUploadImage : handleAddImage}
                            style={[styles.modalBtn, { backgroundColor: config.THEME_COLOR, opacity: imageActionLoading ? 0.6 : 1 }]}>
                            {imageActionLoading === 'upload' ? (
                                <ActivityIndicator size="small" color={colors.textInverse} />
                            ) : (
                                <Lucide name='image-plus' size={20} color={colors.textInverse} />
                            )}
                            <AppText
                                label={
                                    imageActionLoading === 'upload'
                                        ? 'Uploading...'
                                        : selectedImage && selectedImage.isLocal
                                            ? 'Upload Image'
                                            : 'Change Image'
                                }
                                color={colors.textInverse}
                                style={{ marginLeft: 8 }}
                            />
                        </TouchableOpacity>

                        {selectedImage && selectedImage.isLocal && (
                            <TouchableOpacity
                                activeOpacity={.6}
                                disabled={!!imageActionLoading}
                                onPress={handleRemoveImage}
                                style={[styles.modalBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error, marginLeft: 15, opacity: imageActionLoading ? 0.6 : 1 }]}>
                                <Lucide name='trash-2' size={20} color={colors.error} />
                                <AppText label="Remove" color={colors.error} style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        )}

                        {selectedImage && !selectedImage.isLocal && (
                            <TouchableOpacity
                                activeOpacity={.6}
                                disabled={!!imageActionLoading}
                                onPress={handleDeleteImage}
                                style={[styles.modalBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error, marginLeft: 15, opacity: imageActionLoading ? 0.6 : 1 }]}>
                                {imageActionLoading === 'delete' ? (
                                    <ActivityIndicator size="small" color={colors.error} />
                                ) : (
                                    <Lucide name='trash-2' size={20} color={colors.error} />
                                )}
                                <AppText label={imageActionLoading === 'delete' ? 'Deleting...' : 'Delete Image'} color={colors.error} style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerAction: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#f1f3f5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inactiveBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    profileCard: {
        backgroundColor: '#fff',
        paddingTop: 30,
        paddingBottom: 25,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        marginBottom: 20,
    },
    imageSection: {
        alignItems: 'center',
        marginBottom: 15,
    },
    avatarWrapper: {
        width: 110,
        height: 110,
        borderRadius: 55,
        padding: 4,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#eee',
        position: 'relative',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 55,
    },
    cameraBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: config.THEME_COLOR,
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    nameSection: {
        alignItems: 'center',
        marginBottom: 25,
    },
    companyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: config.THEME_COLOR + '10',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 10,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#f1f1f1',
        alignSelf: 'center',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 25,
    },
    sectionTitle: {
        marginBottom: 10,
        marginLeft: 5,
        letterSpacing: 1,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 5,
        padding: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    infoIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f3f5',
        marginLeft: 51,
    },
    billingActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
    },
    fullImageWrapper: {
        width: width * 0.75,
        height: width * 0.75,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#fff',
        elevation: 10,
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    modalActions: {
        flexDirection: 'row',
        marginTop: 30,
        width: '100%',
        justifyContent: 'center',
    },
    modalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 48,
        borderRadius: 24,
        elevation: 2,
    }
});

export default Profile;

