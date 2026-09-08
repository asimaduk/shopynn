"use client";

import { useMemo } from "react";
import i18n from "@i18n";
import useUser from "@auth/useUser";
import useI18n from "@i18n/useI18n";
import FuseNavigationHelper from "@fuse/utils/FuseNavigationHelper";
import { FuseNavItemType } from "@fuse/core/FuseNavigation/types/FuseNavItemType";
import navigationConfig from "src/configs/navigationConfig";
import { resolveNavItemAccess } from "@auth/permissions";
import { getMinimumTierForFeatures, getTierBadgeLetter, normalizeFeatureCode } from "src/configs/subscriptionFeatureTiers";
// import { isFeatureEnabled } from "src/configs/featureFlags";

/** Drop parents (group/collapse/etc.) when every child is denied — section headers with no links. */
function pruneNavWithoutVisibleChildren(
  items: FuseNavItemType[],
): FuseNavItemType[] {
  return items.flatMap((item) => {
    if (item.children && item.children.length > 0) {
      const nextChildren = pruneNavWithoutVisibleChildren(item.children);
      if (nextChildren.length === 0) {
        return [];
      }
      return [{ ...item, children: nextChildren }];
    }
    return item.hasPermission || item.lockedByPlan ? [item] : [];
  });
}

/**
 * Returns navigation tree built from config (no store).
 * Applies permissions and i18n at runtime.
 */
function useNavigation() {
  const { data: user } = useUser();
  const { languageId } = useI18n();

  const navigation = useMemo(() => {
    const isLinkedMerchantUser = Boolean(user?.merchant_id);

    function setAdditionalData(data: FuseNavItemType[]): FuseNavItemType[] {
      return data?.map((item) => {
        const titleFromI18n =
          item?.translate && item?.title
            ? { title: i18n.t(`navigation:${item?.translate}`) }
            : {};
        /** Merchants see their portal as “Clients / Users” (same as MerchantsPage). */
        const merchantsNavTitle =
          item.id === "adminTools.merchants" && isLinkedMerchantUser
            ? { title: "Clients / Shops" }
            : {};

        // console.log('title', item?.title);
        // console.log('requiredPermissions', item?.requiredPermissions);
        // console.log('featureFlag', item?.featureFlag);
        // console.log('requiredFeatures', item?.requiredFeatures);
        const navAccess = resolveNavItemAccess(user, item);
        const requiredFeatures = (Array.isArray(item.requiredFeatures)
          ? item.requiredFeatures
          : item.requiredFeatures
            ? [item.requiredFeatures]
            : []
        ).map((f) => normalizeFeatureCode(String(f)));
        const tierCode =
          navAccess.locked && requiredFeatures.length
            ? getMinimumTierForFeatures(requiredFeatures)
            : null;

        return {
          hasPermission: navAccess.visible && !navAccess.locked,
          lockedByPlan: navAccess.locked,
          url: navAccess.locked ? navAccess.upgradeUrl : item.url,
          badge:
            navAccess.locked && tierCode
              ? {
                  title: getTierBadgeLetter(tierCode),
                  bg: '#EEF2FF',
                  fg: '#4338CA'
                }
              : item.badge,
          ...item,
          ...titleFromI18n,
          ...merchantsNavTitle,
          ...(item?.children
            ? { children: setAdditionalData(item?.children) }
            : {}),
        };
      });
    }

    return pruneNavWithoutVisibleChildren(setAdditionalData(navigationConfig));
  }, [user, languageId]);

  const flattenNavigation = useMemo(() => {
    return FuseNavigationHelper.flattenNavigation(navigation);
  }, [navigation]);

  return { navigation, flattenNavigation };
}

export default useNavigation;
