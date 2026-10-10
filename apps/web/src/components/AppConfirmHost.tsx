"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import {
  AppConfirmRequest,
  settleAppConfirm,
  subscribeAppConfirm,
} from "@/utils/appConfirm";

export default function AppConfirmHost() {
  const [request, setRequest] = useState<AppConfirmRequest | null>(null);

  useEffect(() => subscribeAppConfirm(setRequest), []);

  const settle = (ok: boolean) => {
    if (request) settleAppConfirm(request.id, ok);
  };

  return (
    <Dialog
      open={Boolean(request)}
      onClose={() => settle(false)}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{request?.title}</DialogTitle>
      {request?.message ? (
        <DialogContent>
          <Typography
            variant="body2"
            color="text.secondary"
            className="whitespace-pre-line"
          >
            {request.message}
          </Typography>
        </DialogContent>
      ) : null}
      <DialogActions className="px-6 pb-4">
        <Button onClick={() => settle(false)} className="rounded-full">
          {request?.cancelLabel || "Cancel"}
        </Button>
        <Button
          onClick={() => settle(true)}
          variant="contained"
          color={request?.destructive ? "error" : "primary"}
          className="rounded-full"
          autoFocus
        >
          {request?.confirmLabel || "Confirm"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
