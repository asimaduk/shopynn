import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import useTheme from '../../hooks/useTheme';
import ScreenHeader from '../../components/screen_header';
import FeatureUpgradePrompt from '../../components/FeatureUpgradePrompt';

/**
 * Generic upgrade screen — pass copy via route.params from navigation.navigate('FeatureUpgrade', { ... }).
 */
const FeatureUpgrade = ({ navigation, route }) => {
    const { colors } = useTheme();
    const user = useSelector((state) => state.user);
    const subscriptionPlan = useSelector((state) => state.appSettings?.subscriptionPlan);
    const {
        headerTitle = 'Upgrade required',
        featureTitle = 'This feature',
        requiredPlanName = 'Basic',
        description,
        bullets = [],
    } = route.params || {};

    const currentPlanName =
        subscriptionPlan?.name || user?.settings?.subscription?.name || 'Free';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label={headerTitle} />
            <FeatureUpgradePrompt
                navigation={navigation}
                user={user}
                featureTitle={featureTitle}
                requiredPlanName={requiredPlanName}
                currentPlanName={currentPlanName}
                description={description}
                bullets={bullets}
            />
        </SafeAreaView>
    );
};

export default FeatureUpgrade;
