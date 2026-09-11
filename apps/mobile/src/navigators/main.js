import React, { useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, Text, Pressable, Platform, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Lucide from '@react-native-vector-icons/lucide';
import { useSelector, useDispatch } from 'react-redux';
import { SET_USER } from '../store/actions/user';
import useInactivityTimer from '../hooks/useInactivityTimer';
import { canAccessScreen, hasPermission } from '../utils/permissions';
import {
    flushPendingNotificationNavigation,
    navigateForNotification,
    NOTIFICATION_OPENED_EVENT,
} from '../utils/notificationNavigation';

import Dashboard from '../containers/home/dashboard';
import useTheme from '../hooks/useTheme';

import config from '../config';
import Inventory from '../containers/home/inventory';
import Sales from '../containers/home/sales';
import Purchases from '../containers/home/purchases';
import Settings from '../containers/home/settings';
import SaleDetails from '../containers/home/sale_details';
import PurchaseDetails from '../containers/home/purchase_details';
import ProductDetails from '../containers/home/product_details';
import ProductTransactions from '../containers/home/product_transactions';
import ProductForm from '../containers/home/product_form';
import ProductImport from '../containers/home/product_import';
import Profile from '../containers/settings/profile';
import ProfileForm from '../containers/settings/profile_form';
import ResetPassword from '../containers/settings/reset_password';
import CompanyProfile from '../containers/settings/company_profile';
import Warehouses from '../containers/settings/warehouses';
import Customers from '../containers/settings/customers';
import Expenditures from '../containers/settings/expenditures';
import Suppliers from '../containers/settings/suppliers';
import Reports from '../containers/settings/reports';
import StockSummary from '../containers/settings/stock_summary';
import ReportDetail from '../containers/settings/report_detail';
import NotificationsSetup from '../containers/settings/notifications_setup';
import AboutApp from '../containers/settings/about_app';
import Notifications from '../containers/home/notifications';
import Search from '../containers/home/search';
import NewSale from '../containers/home/new_sale';
import NewPurchase from '../containers/home/new_purchase';
import ProductTransfers from '../containers/home/transfers';
import AdjustedQuantities from '../containers/home/adjusted_quantities';
import ProductCategories from '../containers/settings/product_categories';
import NewTransfer from '../containers/home/new_transfer';
import NewAdjustments from '../containers/home/new_adjustments';
import PendingSales from '../containers/home/pending_sales';
import CategoryForm from '../containers/settings/category_form';
import ProductsByCategory from '../containers/home/products_by_category';
import CreateWarehouse from '../containers/settings/create_warehouse';
import EditWarehouse from '../containers/settings/edit_warehouse';
import CreateLocation from '../containers/settings/create_location';
import AdjustmentDetails from '../containers/home/adjustment_details';
import TransferDetails from '../containers/home/transfer_details';
import CustomerDetails from '../containers/settings/customer_details';
import CustomerSale from '../containers/settings/customer_sales';
import CustomerPayments from '../containers/settings/customer_payments';
import CustomerPaymentDetails from '../containers/settings/customer_payment_details';
import SupplierDetails from '../containers/settings/supplier_details';
import SupplierForm from '../containers/settings/supplier_form';
import SupplierSupplies from '../containers/settings/supplier_supplies';
import ExpenditureDetails from '../containers/settings/expenditure_details';
import CreateExpenditure from '../containers/settings/create_expenditure';
import TransactionDetails from '../containers/home/transaction_details';
import CustomerForm from '../containers/settings/customer_form';
import BarcodeScanner from '../containers/home/barcode_scanner';
import InvoiceReceiptSettings from '../containers/settings/invoice_receipt_settings';
import PrintAgentSettings from '../containers/settings/print_agent_settings';
import DataExportBackup from '../containers/settings/data_export_backup';
import Returns from '../containers/home/returns';
import NewSaleReturn from '../containers/home/new_sale_return';
import NewPurchaseReturn from '../containers/home/new_purchase_return';
import ReturnDetails from '../containers/home/return_details';
import ReturnItems from '../containers/home/return_items';
import StockCount from '../containers/home/stock_count';
import StockCountHistory from '../containers/home/stock_count_history';
import StockCountDetails from '../containers/home/stock_count_details';
import ItemsToReorder from '../containers/home/items_to_reorder';
import ExpiringSoon from '../containers/home/expiring_soon';
import DailySales from '../containers/home/daily_sales';
import FeatureUpgrade from '../containers/home/feature_upgrade';
import DaySalesList from '../containers/home/day_sales_list';
import Subscription from '../containers/settings/subscription';
import Payment from '../containers/settings/payment';
import PaymentHistory from '../containers/settings/payment_history';
import OrderPayments from '../containers/settings/order_payments';
import OrderSettlements from '../containers/settings/order_settlements';
import OrderPaymentDetails from '../containers/settings/order_payment_details';
import PaymentWebView from '../containers/settings/payment_webview';
import MomoProcessing from '../containers/settings/momo_processing';
import MomoStatus from '../containers/settings/momo_status';
import PaymentInvoice from '../containers/settings/payment_invoice';
import PurchaseOrders from '../containers/home/purchase_orders';
import CreatePurchaseOrder from '../containers/home/create_purchase_order';
import PurchaseOrderDetails from '../containers/home/purchase_order_details';
import ReceiveAgainstPO from '../containers/home/receive_against_po';
import Orders from '../containers/home/orders';
import CreateOrder from '../containers/home/create_order';
import OrderDetails from '../containers/home/order_details';
import ForYou from '../containers/home/for_you';
import ForYouProductDetails from '../containers/home/for_you_product_details';
import ForYouSearch from '../containers/home/for_you_search';
import Cart from '../containers/home/cart';
import Checkout from '../containers/home/checkout';
import CheckoutSuccess from '../containers/home/checkout_success';
import MyOrders from '../containers/home/my_orders';
import MyOrderDetails from '../containers/home/my_order_details';
import { subscribeCart } from '../store/cartStore';
import Users from '../containers/settings/users';
import UserDetails from '../containers/settings/user_details';
import UserForm from '../containers/settings/user_form';
import Roles from '../containers/settings/roles';
import AuditLogDetails from '../containers/settings/audit_log_details';
import MerchantPortal from '../containers/settings/merchant_portal';
import MerchantDetail from '../containers/settings/merchant_detail';
import MerchantAdd from '../containers/settings/merchant_add';
import MerchantOnboard from '../containers/settings/merchant_onboard';
import MerchantCollect from '../containers/settings/merchant_collect';
import MerchantAddServices from '../containers/settings/merchant_add_services';
import MerchantUpgradeCollect from '../containers/settings/merchant_upgrade_collect';
import UpgradePrompt from '../containers/settings/upgrade_prompt';
import TenantsDirectory from '../containers/settings/tenants_directory';
import TenantDirectoryDetail from '../containers/settings/tenant_directory_detail';
import BillingCatalog from '../containers/settings/billing_catalog';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
export const rootNavigationRef = createNavigationContainerRef();

function AnimatedTabButton(props) {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));
    const handlePress = () => {
        scale.value = withSequence(
            withTiming(0.86, { duration: 60 }),
            withSpring(1, { damping: 14, stiffness: 220 })
        );
        props.onPress?.();
    };
    return (
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            <Pressable {...props} onPress={handlePress} style={[props.style, { flex: 1 }]} android_ripple={null}>
                {props.children}
            </Pressable>
        </Animated.View>
    );
}

function HomeStackScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const allowDashboard = canAccessScreen(user, 'Dashboard', subscriptionFeatures);
    const allowInventory = canAccessScreen(user, 'Inventory', subscriptionFeatures);
    const allowSales = canAccessScreen(user, 'Sales', subscriptionFeatures);
    const allowPurchases = canAccessScreen(user, 'Purchases', subscriptionFeatures);
    const allowForYou = canAccessScreen(user, 'ForYou', subscriptionFeatures);
    const allowCart = canAccessScreen(user, 'Cart', subscriptionFeatures);
    const allowMyOrders = canAccessScreen(user, 'MyOrders', subscriptionFeatures);
    /** Clients tab: operate-only users. Users with merchants.view open Clients from More / Settings instead. */
    const allowMerchantPortalTab =
        canAccessScreen(user, 'MerchantPortal', subscriptionFeatures) &&
        hasPermission(user, ['merchants.operate']) &&
        !hasPermission(user, ['merchants.view']);
    const [cartCount, setCartCount] = useState(0);

    useEffect(() => {
        const unsubscribe = subscribeCart((items) => {
            const count = Array.isArray(items)
                ? items.reduce((sum, it) => sum + Number(it.quantity || 0), 0)
                : 0;
            setCartCount(count);
        });
        return unsubscribe;
    }, []);

    const cartBadgeLabel = useMemo(() => {
        if (cartCount <= 0) return '';
        return cartCount > 99 ? '99+' : String(cartCount);
    }, [cartCount]);
    
    return (
        <Tab.Navigator
            screenOptions={{
                // We apply bottom inset via tabBarStyle; avoid RN adding a second inset.
                safeAreaInsets: { bottom: 0 },
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: 56 + Math.max(insets.bottom, 8),
                    paddingBottom: Math.max(insets.bottom, 8),
                    paddingTop: 6,
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    elevation: 8,
                    shadowColor: colors.shadow,
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                },
                tabBarActiveTintColor: config.THEME_COLOR,
                tabBarInactiveTintColor: colors.textTertiary,
                tabBarLabelStyle: {
                    fontFamily: 'FiraSans-SemiBold',
                    fontSize: 11,
                },
                tabBarButton: (props) => <AnimatedTabButton {...props} />,
            }}>
            {(allowDashboard) && <Tab.Screen
                name="Dashboard"
                component={Dashboard}
                options={{
                    headerShown: false,
                    tabBarIcon: ({ size, color, focused }) => (
                        <Lucide name='layout-dashboard' color={focused ? config.THEME_COLOR : colors.textTertiary} size={size} />
                    ),
                    tabBarLabel: ({ focused }) => (
                        <Text style={{ fontFamily: 'FiraSans-SemiBold', fontSize: 11, color: focused ? config.THEME_COLOR : colors.textTertiary }}>Dashboard</Text>
                    )
                }}
            />}
            {allowInventory && <Tab.Screen
                name="Inventory"
                component={Inventory}
                options={{
                    headerShown: false,
                    tabBarIcon: ({ size, color }) => (
                        <Lucide name='boxes' color={color} size={size} />
                    ),
                    tabBarLabelStyle: {
                        fontFamily: 'FiraSans-SemiBold'
                    }
                }}
            />}
            {allowSales && <Tab.Screen
                name="Sales"
                component={Sales}
                options={{
                    headerShown: false,
                    tabBarIcon: ({ size, color }) => (
                        <Lucide name='shopping-cart' color={color} size={size} />
                    ),
                    tabBarLabelStyle: {
                        fontFamily: 'FiraSans-SemiBold'
                    }
                }}
            />}
            {allowPurchases && <Tab.Screen
                name="Purchases"
                component={Purchases}
                options={{
                    headerShown: false,
                    tabBarIcon: ({ size, color }) => (
                        <Lucide name='bookmark-check' color={color} size={size} />
                    ),
                    tabBarLabelStyle: {
                        fontFamily: 'FiraSans-SemiBold'
                    }
                }}
            />}
            {allowForYou && (
                <Tab.Screen
                    name="ForYou"
                    component={ForYou}
                    options={{
                        headerShown: false,
                        tabBarIcon: ({ size, color }) => (
                            <Lucide name='sparkles' color={color} size={size} />
                        ),
                        tabBarLabel: 'Home',
                        tabBarLabelStyle: { fontFamily: 'FiraSans-SemiBold' },
                    }}
                />
            )}
            {allowCart && (
                <Tab.Screen
                    name="Cart"
                    component={Cart}
                    options={{
                        headerShown: false,
                        tabBarIcon: ({ size, color }) => (
                            <View>
                                <Lucide name='shopping-bag' color={color} size={size} />
                                {cartCount > 0 && (
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: -6,
                                            right: -10,
                                            minWidth: 16,
                                            height: 16,
                                            borderRadius: 8,
                                            backgroundColor: '#ef4444',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            paddingHorizontal: 4,
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'FiraSans-SemiBold' }}>
                                            {cartBadgeLabel}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ),
                        tabBarLabelStyle: { fontFamily: 'FiraSans-SemiBold' },
                    }}
                />
            )}
            {allowMyOrders && (
                <Tab.Screen
                    name="MyOrders"
                    component={MyOrders}
                    options={{
                        headerShown: false,
                        tabBarIcon: ({ size, color }) => (
                            <Lucide name='package-search' color={color} size={size} />
                        ),
                        tabBarLabel: 'My Orders',
                        tabBarLabelStyle: { fontFamily: 'FiraSans-SemiBold' },
                    }}
                />
            )}
            {allowMerchantPortalTab && (
                <Tab.Screen
                    name="ClientsTab"
                    component={MerchantPortal}
                    options={{
                        headerShown: false,
                        tabBarIcon: ({ size, color, focused }) => (
                            <Lucide
                                name="building-2"
                                color={focused ? config.THEME_COLOR : color}
                                size={size}
                            />
                        ),
                        tabBarLabel: ({ focused }) => (
                            <Text
                                style={{
                                    fontFamily: 'FiraSans-SemiBold',
                                    fontSize: 11,
                                    color: focused ? config.THEME_COLOR : colors.textTertiary,
                                }}
                            >
                                Clients
                            </Text>
                        ),
                    }}
                />
            )}
            <Tab.Screen
                name="More"
                component={Settings}
                options={{
                    headerShown: false,
                    tabBarIcon: ({ size, color }) => (
                        <Lucide name='user-cog' color={color} size={size} />
                    ),
                    tabBarLabelStyle: {
                        fontFamily: 'FiraSans-SemiBold'
                    }
                }}
            />
        </Tab.Navigator>
    );
}

function MainNavigator({ user }) {
    const isLoggedIn = useSelector(({ user: sUser }) => sUser?.isLoggedIn);
    const postLoginScreen = useSelector(({ user: sUser }) => sUser?.postLoginScreen);
    const dispatch = useDispatch();

    // Initialize inactivity timer - tracks navigation events and app state changes
    const { onNavigationStateChange } = useInactivityTimer(isLoggedIn);

    useEffect(() => {
        if (postLoginScreen !== 'ClientsTab') return undefined;
        const id = requestAnimationFrame(() => {
            if (rootNavigationRef.isReady()) {
                rootNavigationRef.navigate('Home', { screen: 'ClientsTab' });
                dispatch({ type: SET_USER, payload: { postLoginScreen: null } });
            }
        });
        return () => cancelAnimationFrame(id);
    }, [postLoginScreen, dispatch]);

    useEffect(() => {
        const tryNavigate = (notification) => {
            if (navigateForNotification(rootNavigationRef, notification)) {
                return;
            }
            let attempts = 0;
            const timer = setInterval(() => {
                attempts += 1;
                if (navigateForNotification(rootNavigationRef, notification) || attempts >= 40) {
                    clearInterval(timer);
                }
            }, 250);
        };

        const sub = DeviceEventEmitter.addListener(NOTIFICATION_OPENED_EVENT, tryNavigate);

        // Cold start: notification may have been opened before this navigator mounted.
        const flushTimer = setTimeout(() => {
            flushPendingNotificationNavigation(rootNavigationRef);
        }, 400);

        return () => {
            sub.remove();
            clearTimeout(flushTimer);
        };
    }, []);

    return (
        <NavigationContainer
            ref={rootNavigationRef}
            onStateChange={onNavigationStateChange}
            onReady={() => {
                flushPendingNotificationNavigation(rootNavigationRef);
            }}
        >
            <Stack.Navigator>
                <Stack.Screen name="Home" component={HomeStackScreen} options={{ headerShown: false }} />
                <Stack.Screen name="SaleDetails" component={SaleDetails} options={{ headerShown: false }} />
                <Stack.Screen name="PurchaseDetails" component={PurchaseDetails} options={{ headerShown: false }} />
                <Stack.Screen name="ProductDetails" component={ProductDetails} options={{ headerShown: false }} />
                <Stack.Screen name="ForYouProductDetails" component={ForYouProductDetails} options={{ headerShown: false }} />
                <Stack.Screen name="ForYouSearch" component={ForYouSearch} options={{ headerShown: false }} />
                <Stack.Screen name="ProductTransactions" component={ProductTransactions} options={{ headerShown: false }} />
                <Stack.Screen name="ProductForm" component={ProductForm} options={{ headerShown: false }} />
                <Stack.Screen name="ProductImport" component={ProductImport} options={{ headerShown: false }} />
                <Stack.Screen name="Profile" component={Profile} options={{ headerShown: false }} />
                <Stack.Screen name="ProfileForm" component={ProfileForm} options={{ headerShown: false }} />
                <Stack.Screen name="ResetPassword" component={ResetPassword} options={{ headerShown: false }} />
                <Stack.Screen name="CompanyProfile" component={CompanyProfile} options={{ headerShown: false }} />
                <Stack.Screen name="Warehouses" component={Warehouses} options={{ headerShown: false }} />
                <Stack.Screen name="Customers" component={Customers} options={{ headerShown: false }} />
                <Stack.Screen name="Expenditures" component={Expenditures} options={{ headerShown: false }} />
                <Stack.Screen name="Suppliers" component={Suppliers} options={{ headerShown: false }} />
                <Stack.Screen name="Reports" component={Reports} options={{ headerShown: false }} />
                <Stack.Screen name="StockSummary" component={StockSummary} options={{ headerShown: false }} />
                <Stack.Screen name="ReportDetail" component={ReportDetail} options={{ headerShown: false }} />
                <Stack.Screen name="NotificationsSetup" component={NotificationsSetup} options={{ headerShown: false }} />
                <Stack.Screen name="Subscription" component={Subscription} options={{ headerShown: false }} />
                <Stack.Screen name="Payment" component={Payment} options={{ headerShown: false }} />
                <Stack.Screen name="PaymentHistory" component={PaymentHistory} options={{ headerShown: false }} />
                <Stack.Screen name="OrderPayments" component={OrderPayments} options={{ headerShown: false }} />
                <Stack.Screen name="OrderSettlements" component={OrderSettlements} options={{ headerShown: false }} />
                <Stack.Screen name="OrderPaymentDetails" component={OrderPaymentDetails} options={{ headerShown: false }} />
                <Stack.Screen name="PaymentWebView" component={PaymentWebView} options={{ headerShown: false }} />
                <Stack.Screen name="MomoProcessing" component={MomoProcessing} options={{ headerShown: false }} />
                <Stack.Screen name="MomoStatus" component={MomoStatus} options={{ headerShown: false }} />
                <Stack.Screen name="PaymentInvoice" component={PaymentInvoice} options={{ headerShown: false }} />
                <Stack.Screen name="AboutApp" component={AboutApp} options={{ headerShown: false }} />
                <Stack.Screen name="Notifications" component={Notifications} options={{ headerShown: false }} />
                <Stack.Screen name="Search" component={Search} options={{ headerShown: false }} />
                <Stack.Screen name="BarcodeScanner" component={BarcodeScanner} options={{ headerShown: false }} />
                <Stack.Screen name="NewSale" component={NewSale} options={{ headerShown: false }} />
                <Stack.Screen name="NewPurchase" component={NewPurchase} options={{ headerShown: false }} />
                <Stack.Screen name="ProductTransfers" component={ProductTransfers} options={{ headerShown: false }} />
                <Stack.Screen name="AdjustedQuantities" component={AdjustedQuantities} options={{ headerShown: false }} />
                <Stack.Screen name="ProductCategories" component={ProductCategories} options={{ headerShown: false }} />
                <Stack.Screen name="NewTransfer" component={NewTransfer} options={{ headerShown: false }} />
                <Stack.Screen name="NewAdjustments" component={NewAdjustments} options={{ headerShown: false }} />
                <Stack.Screen name="PendingSales" component={PendingSales} options={{ headerShown: false }} />
                <Stack.Screen name="CategoryForm" component={CategoryForm} options={{ headerShown: false }} />
                <Stack.Screen name="ProductsByCategory" component={ProductsByCategory} options={{ headerShown: false }} />
                <Stack.Screen name="CreateWarehouse" component={CreateWarehouse} options={{ headerShown: false }} />
                <Stack.Screen name="EditWarehouse" component={EditWarehouse} options={{ headerShown: false }} />
                <Stack.Screen name="CreateLocation" component={CreateLocation} options={{ headerShown: false }} />
                <Stack.Screen name="AdjustmentDetails" component={AdjustmentDetails} options={{ headerShown: false }} />
                <Stack.Screen name="TransferDetails" component={TransferDetails} options={{ headerShown: false }} />
                <Stack.Screen name="CustomerDetails" component={CustomerDetails} options={{ headerShown: false }} />
                <Stack.Screen name="CustomerSale" component={CustomerSale} options={{ headerShown: false }} />
                <Stack.Screen name="CustomerPayments" component={CustomerPayments} options={{ headerShown: false }} />
                <Stack.Screen name="CustomerPaymentDetails" component={CustomerPaymentDetails} options={{ headerShown: false }} />
                <Stack.Screen name="SupplierDetails" component={SupplierDetails} options={{ headerShown: false }} />
                <Stack.Screen name="SupplierForm" component={SupplierForm} options={{ headerShown: false }} />
                <Stack.Screen name="SupplierSupplies" component={SupplierSupplies} options={{ headerShown: false }} />
                <Stack.Screen name="ExpenditureDetails" component={ExpenditureDetails} options={{ headerShown: false }} />
                <Stack.Screen name="CreateExpenditure" component={CreateExpenditure} options={{ headerShown: false }} />
                <Stack.Screen name="TransactionDetails" component={TransactionDetails} options={{ headerShown: false }} />
                <Stack.Screen name="CustomerForm" component={CustomerForm} options={{ headerShown: false }} />
                <Stack.Screen name="InvoiceReceiptSettings" component={InvoiceReceiptSettings} options={{ headerShown: false }} />
                <Stack.Screen name="PrintAgentSettings" component={PrintAgentSettings} options={{ headerShown: false }} />
                <Stack.Screen name="DataExportBackup" component={DataExportBackup} options={{ headerShown: false }} />
                <Stack.Screen name="Returns" component={Returns} options={{ headerShown: false }} />
                <Stack.Screen name="NewSaleReturn" component={NewSaleReturn} options={{ headerShown: false }} />
                <Stack.Screen name="NewPurchaseReturn" component={NewPurchaseReturn} options={{ headerShown: false }} />
                <Stack.Screen name="ReturnDetails" component={ReturnDetails} options={{ headerShown: false }} />
                <Stack.Screen name="ReturnItems" component={ReturnItems} options={{ headerShown: false }} />
                <Stack.Screen name="StockCount" component={StockCount} options={{ headerShown: false }} />
                <Stack.Screen name="StockCountHistory" component={StockCountHistory} options={{ headerShown: false }} />
                <Stack.Screen name="StockCountDetails" component={StockCountDetails} options={{ headerShown: false }} />
                <Stack.Screen name="ItemsToReorder" component={ItemsToReorder} options={{ headerShown: false }} />
                <Stack.Screen name="ExpiringSoon" component={ExpiringSoon} options={{ headerShown: false }} />
                <Stack.Screen name="PurchaseOrders" component={PurchaseOrders} options={{ headerShown: false }} />
                <Stack.Screen name="CreatePurchaseOrder" component={CreatePurchaseOrder} options={{ headerShown: false }} />
                <Stack.Screen name="PurchaseOrderDetails" component={PurchaseOrderDetails} options={{ headerShown: false }} />
                <Stack.Screen name="ReceiveAgainstPO" component={ReceiveAgainstPO} options={{ headerShown: false }} />
                <Stack.Screen name="Orders" component={Orders} options={{ headerShown: false }} />
                <Stack.Screen name="CreateOrder" component={CreateOrder} options={{ headerShown: false }} />
                <Stack.Screen name="OrderDetails" component={OrderDetails} options={{ headerShown: false }} />
                <Stack.Screen name="Checkout" component={Checkout} options={{ headerShown: false }} />
                <Stack.Screen name="CheckoutSuccess" component={CheckoutSuccess} options={{ headerShown: false }} />
                <Stack.Screen name="MyOrders" component={MyOrders} options={{ headerShown: false }} />
                <Stack.Screen name="MyOrderDetails" component={MyOrderDetails} options={{ headerShown: false }} />
                <Stack.Screen name="Users" component={Users} options={{ headerShown: false }} />
                <Stack.Screen name="Roles" component={Roles} options={{ headerShown: false }} />
                <Stack.Screen name="UserDetails" component={UserDetails} options={{ headerShown: false }} />
                <Stack.Screen name="UserForm" component={UserForm} options={{ headerShown: false }} />
                <Stack.Screen name="AuditLogDetails" component={AuditLogDetails} options={{ headerShown: false }} />
                <Stack.Screen name="DailySales" component={DailySales} options={{ headerShown: false }} />
                <Stack.Screen name="FeatureUpgrade" component={FeatureUpgrade} options={{ headerShown: false }} />
                <Stack.Screen name="DaySalesList" component={DaySalesList} options={{ headerShown: false }} />
                <Stack.Screen name="MerchantOnboard" component={MerchantOnboard} options={{ headerShown: false }} />
                <Stack.Screen name="MerchantCollect" component={MerchantCollect} options={{ headerShown: false }} />
                <Stack.Screen name="MerchantAddServices" component={MerchantAddServices} options={{ headerShown: false }} />
                <Stack.Screen name="MerchantUpgradeCollect" component={MerchantUpgradeCollect} options={{ headerShown: false }} />
                <Stack.Screen name="UpgradePrompt" component={UpgradePrompt} options={{ headerShown: false }} />
                <Stack.Screen name="MerchantPortal" component={MerchantPortal} options={{ headerShown: false }} />
                <Stack.Screen name="MerchantAdd" component={MerchantAdd} options={{ headerShown: false }} />
                <Stack.Screen name="MerchantDetail" component={MerchantDetail} options={{ headerShown: false }} />
                <Stack.Screen name="TenantsDirectory" component={TenantsDirectory} options={{ headerShown: false }} />
                <Stack.Screen name="TenantDirectoryDetail" component={TenantDirectoryDetail} options={{ headerShown: false }} />
                <Stack.Screen name="BillingCatalog" component={BillingCatalog} options={{ headerShown: false }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default MainNavigator;