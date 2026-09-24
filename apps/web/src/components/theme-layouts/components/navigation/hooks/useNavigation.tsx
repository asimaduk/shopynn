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
import { useGetGoLiveNavQuery } from "src/app/(control-panel)/billing/SubscriptionApi";

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
  const { data: goLiveNav } = useGetGoLiveNavQuery(undefined, {
    skip: !user?.id || !user?.company,
    refetchOnFocus: true,
  });

  const showGoLive = useMemo(() => {
    // Only for tenant shops; hide once any sale exists (session or live probe).
    if (!user?.company) return false;
    if (user.company.has_first_sale || goLiveNav?.has_first_sale) return false;
    if (goLiveNav && goLiveNav.show_go_live === false) return false;
    return true;
  }, [user?.company, goLiveNav]);

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
          (item.id === "platform.merchants" || item.id === "adminTools.merchants") &&
          isLinkedMerchantUser
            ? { title: "Clients / Shops" }
            : {};

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

        const goLiveHidden =
          item.id === "setups.goLive" && !showGoLive
            ? { hasPermission: false, lockedByPlan: false }
            : null;

        return {
          ...item,
          ...titleFromI18n,
          ...merchantsNavTitle,
          hasPermission: goLiveHidden
            ? false
            : navAccess.visible && !navAccess.locked,
          lockedByPlan: goLiveHidden ? false : navAccess.locked,
          url: navAccess.locked && !goLiveHidden ? navAccess.upgradeUrl : item.url,
          badge:
            navAccess.locked && tierCode && !goLiveHidden
              ? {
                  title: getTierBadgeLetter(tierCode),
                  bg: "#EEF2FF",
                  fg: "#4338CA",
                }
              : item.badge,
          ...(item?.children
            ? { children: setAdditionalData(item?.children) }
            : {}),
        };
      });
    }

    return pruneNavWithoutVisibleChildren(setAdditionalData(navigationConfig));
  }, [user, languageId, showGoLive]);

  const flattenNavigation = useMemo(() => {
    return FuseNavigationHelper.flattenNavigation(navigation);
  }, [navigation]);

  return { navigation, flattenNavigation };
}

export default useNavigation;
