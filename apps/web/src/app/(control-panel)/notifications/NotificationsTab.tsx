"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import FuseLoading from "@fuse/core/FuseLoading";
import FuseSvgIcon from "@fuse/core/FuseSvgIcon";
import { useSnackbar } from "notistack";
import {
  useGetMePreferencesQuery,
  useUpdateMePreferencesMutation,
} from "../apps/profile/ProfileApi";

/** Mirrors `cheqstock/src/containers/settings/notifications_setup.js` + `/api/users/me/preferences`. */
type NotifTypesState = {
  lowStock: boolean;
  newSale: boolean;
  onlineOrders: boolean;
  dailySummary: boolean;
  marketing: boolean;
};

const DEFAULT_SETTINGS: NotifTypesState = {
  lowStock: true,
  newSale: true,
  onlineOrders: true,
  dailySummary: false,
  marketing: false,
};

/** Loose shape of `/api/users/me/preferences` for notification + locale fields. */
type MePreferencesShape = {
  notifications?: Record<string, unknown>;
  locale?: unknown;
  timezone?: unknown;
};

function preferencesToSettings(
  prefs: Record<string, unknown> | null | undefined,
): NotifTypesState {
  const types = (prefs as MePreferencesShape | null | undefined)?.notifications
    ?.types as string[] | Record<string, boolean | undefined> | undefined;

  if (!types) return { ...DEFAULT_SETTINGS };

  if (Array.isArray(types)) {
    return Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS).map((k) => {
        if (k === "onlineOrders") {
          return [
            k,
            types.includes("onlineOrders") || types.includes("approvals"),
          ];
        }
        return [k, types.includes(k)];
      }),
    ) as NotifTypesState;
  }

  const t = types;
  return {
    lowStock: t.lowStock !== false,
    newSale: t.newSale !== false,
    onlineOrders:
      t.onlineOrders === false
        ? false
        : t.onlineOrders === true
          ? true
          : t.approvals !== false,
    dailySummary: t.dailySummary === true,
    marketing: t.marketing === true,
  };
}

function settingsToPreferences(
  settings: NotifTypesState,
  existingPrefs: Record<string, unknown> | null | undefined,
) {
  const existing = existingPrefs as MePreferencesShape | null | undefined;
  const notif =
    (existing?.notifications as Record<string, unknown> | undefined) || {};
  const body: Record<string, unknown> = {
    notifications: {
      ...notif,
      types: { ...DEFAULT_SETTINGS, ...settings },
    },
  };

  if (existing?.locale != null) body.locale = existing.locale;
  if (existing?.timezone != null) body.timezone = existing.timezone;

  return body;
}

type SettingRowProps = {
  label: string;
  description: string;
  icon: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  accent: string;
  isLast?: boolean;
};

function SettingRow(props: SettingRowProps) {
  const theme = useTheme();
  const {
    label,
    description,
    icon,
    checked,
    disabled,
    onChange,
    accent,
    isLast,
  } = props;

  return (
    <>
      <ListItem
        alignItems="flex-start"
        secondaryAction={
          <Switch
            edge="end"
            size="small"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            color="primary"
            inputProps={{ "aria-label": label }}
          />
        }
        sx={{
          py: 2,
          px: 2.5,
          pr: 7,
          "&:hover": {
            bgcolor: alpha(
              theme.palette.primary.main,
              theme.palette.mode === "dark" ? 0.06 : 0.03,
            ),
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 52, mt: 0.25 }}>
          <Avatar
            variant="rounded"
            sx={{
              width: 40,
              height: 40,
              bgcolor: alpha(
                accent,
                theme.palette.mode === "dark" ? 0.22 : 0.12,
              ),
              color: accent,
            }}
          >
            <FuseSvgIcon size={20}>{icon}</FuseSvgIcon>
          </Avatar>
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography
              variant="subtitle2"
              component="span"
              sx={{ fontWeight: 600, lineHeight: 1.35 }}
            >
              {label}
            </Typography>
          }
          secondary={
            <Typography
              variant="body2"
              color="text.secondary"
              component="span"
              sx={{ mt: 0.5, display: "block", lineHeight: 1.5 }}
            >
              {description}
            </Typography>
          }
          sx={{ my: 0 }}
        />
      </ListItem>
      {!isLast ? (
        <Divider component="li" sx={{ ml: "calc(52px + 20px)" }} />
      ) : null}
    </>
  );
}

function SectionCard(props: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { title, accent, children } = props;

  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        borderColor: alpha(
          theme.palette.divider,
          theme.palette.mode === "dark" ? 0.9 : 1,
        ),
        boxShadow:
          theme.palette.mode === "dark"
            ? "none"
            : `0 1px 2px ${alpha(theme.palette.common.black, 0.04)}`,
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.25,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: alpha(accent, theme.palette.mode === "dark" ? 0.12 : 0.06),
        }}
      >
        <Typography
          variant="overline"
          sx={{
            fontWeight: 700,
            letterSpacing: "0.08em",
            color:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.common.white, 0.75)
                : "text.secondary",
            fontSize: "0.68rem",
          }}
        >
          {title}
        </Typography>
      </Box>
      <List disablePadding sx={{ py: 0 }}>
        {children}
      </List>
    </Paper>
  );
}

export default function NotificationsTab() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const accent = theme.palette.primary.main;
  const accentSecondary = theme.palette.secondary.main;

  const {
    data: preferences,
    isLoading,
    isError,
    refetch,
  } = useGetMePreferencesQuery();
  const [updateMePreferences, { isLoading: saving }] =
    useUpdateMePreferencesMutation();

  const [settings, setSettings] = useState<NotifTypesState>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (preferences != null) {
      setSettings(
        preferencesToSettings(preferences as Record<string, unknown>),
      );
    }
  }, [preferences]);

  const toggle = useCallback(
    async (key: keyof NotifTypesState) => {
      const prev = settings;
      const next = { ...settings, [key]: !settings[key] };
      setSettings(next);
      try {
        const body = settingsToPreferences(
          next,
          preferences as Record<string, unknown> | null | undefined,
        );
        await updateMePreferences(body).unwrap();
        await refetch();
      } catch (e: unknown) {
        setSettings(prev);
        const msg =
          (e as { data?: { message?: string } })?.data?.message ||
          (e as Error)?.message ||
          "Failed to save preferences";
        enqueueSnackbar(msg, { variant: "error" });
      }
    },
    [settings, preferences, updateMePreferences, refetch, enqueueSnackbar],
  );

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, pb: 6 }}>
        <Paper
          variant="outlined"
          elevation={0}
          sx={{
            borderRadius: 2,
            minHeight: 280,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            borderStyle: "dashed",
          }}
        >
          <FuseLoading />
          <Typography variant="body2" color="text.secondary">
            Loading preferences…
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container maxWidth="md" sx={{ py: 4, pb: 6 }}>
        <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
          Could not load notification preferences. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4, pb: 8 }}>
      <Stack spacing={3}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ maxWidth: 560 }}>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              Notification settings
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, lineHeight: 1.6 }}
            >
              Choose which alerts you want. Each toggle saves immediately—the
              same categories as the Cheqstock app.
            </Typography>
          </Box>
          {saving ? (
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ color: "text.secondary", pt: 0.5 }}
            >
              <CircularProgress size={20} thickness={4} />
              <Typography variant="body2" fontWeight={500}>
                Saving…
              </Typography>
            </Stack>
          ) : null}
        </Box>

        {saving ? <LinearProgress sx={{ borderRadius: 1, height: 3 }} /> : null}

        <Alert
          severity="info"
          variant="outlined"
          icon={
            <FuseSvgIcon size={22}>
              heroicons-outline:information-circle
            </FuseSvgIcon>
          }
          sx={{
            borderRadius: 2,
            alignItems: "flex-start",
            "& .MuiAlert-message": { pt: 0.25 },
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Delivery uses your account notification channels (for example push
            on mobile). On web, time-sensitive items may also appear in the
            notification panel.
          </Typography>
        </Alert>

        <SectionCard title="Inventory & sales" accent={accent}>
          <SettingRow
            label="Low stock alerts"
            description="When products fall below minimum levels."
            icon="heroicons-outline:cube"
            checked={settings.lowStock}
            disabled={saving}
            onChange={() => toggle("lowStock")}
            accent={accent}
          />
          <SettingRow
            label="New sales"
            description="Every new transaction."
            icon="heroicons-outline:shopping-cart"
            checked={settings.newSale}
            disabled={saving}
            onChange={() => toggle("newSale")}
            accent={accent}
            isLast
          />
        </SectionCard>

        <SectionCard title="Operations & reports" accent={accentSecondary}>
          <SettingRow
            label="Online orders"
            description="Push alerts for new store orders and when order status changes for customers you serve."
            icon="heroicons-outline:archive-box"
            checked={settings.onlineOrders}
            disabled={saving}
            onChange={() => toggle("onlineOrders")}
            accent={accentSecondary}
          />
          <SettingRow
            label="Daily summary"
            description="End-of-day performance snapshot."
            icon="heroicons-outline:chart-bar"
            checked={settings.dailySummary}
            disabled={saving}
            onChange={() => toggle("dailySummary")}
            accent={accentSecondary}
            isLast
          />
        </SectionCard>

        {/* <SectionCard title="Optional" accent={alpha(accent, 0.9)}>
          <SettingRow
            label="Product news & tips"
            description="Occasional updates and tips (not required for inventory or sales alerts)."
            icon="heroicons-outline:megaphone"
            checked={settings.marketing}
            disabled={saving}
            onChange={() => toggle("marketing")}
            accent={accent}
            isLast
          />
        </SectionCard> */}
      </Stack>
    </Container>
  );
}
