import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../containers/auth/login';
import CustomerSignup from '../containers/auth/signup';
import ChooseAccountType from '../containers/auth/choose_account_type';
import ShopOwnerSignup from '../containers/auth/shop_owner_signup';
import ForgotPassword from '../containers/auth/forgot_password';
import GetStarted from '../containers/auth/getStarted';
import ResetPassword from '../containers/settings/reset_password';
import CompanyDetailsSetup from '../containers/auth/company_details_setup';
import { useSelector } from 'react-redux';

const Stack = createNativeStackNavigator();

function AuthNavigator() {
    const user = useSelector((state) => state.user);
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user?.loggedInBefore ? (
                    <Stack.Screen name="Login" component={Login} />
                ) : (
                    <Stack.Screen name="GetStarted" component={GetStarted} />
                )}
                {!user?.loggedInBefore && <Stack.Screen name="Login" component={Login} />}
                <Stack.Screen name="ChooseAccountType" component={ChooseAccountType} />
                <Stack.Screen name="CustomerSignup" component={CustomerSignup} />
                <Stack.Screen name="ShopOwnerSignup" component={ShopOwnerSignup} />
                {/* @deprecated use CustomerSignup — kept for deep links */}
                <Stack.Screen name="Signup" component={CustomerSignup} />
                <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
                <Stack.Screen name="CompanyDetailsSetup" component={CompanyDetailsSetup} />
                <Stack.Screen name="ResetPassword" component={ResetPassword} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
  
export default AuthNavigator;