# Shopynn Print

On-prem USB thermal receipt agent. Runs on the checkout PC (not Railway/Vercel).

- Listens on `http://0.0.0.0:3001`
- `GET /health` — agent status + USB probe
- `POST /print` — ESC/POS receipt body (same payload as mobile/web New Sale)

## Merchant install

### macOS
1. Open `ShopynnPrint-<version>.pkg` (built via `npm run package:mac`).
2. Complete the installer (admin password).
3. Plug in the USB thermal printer.
4. In Shopynn mobile: **More → Print agent** → enter this Mac’s LAN IP → **Test connection** → Save.
5. Set the warehouse printer type to **Thermal**.

Uninstall:
```bash
sudo bash /path/to/repo/apps/print/packaging/mac/scripts/uninstall.sh
```

### Windows
1. Run `ShopynnPrintSetup-<version>.exe` as Administrator.
2. Finish the wizard (service installs automatically on port **3001**).
3. Plug in the USB thermal printer.
4. **Install WinUSB with Zadig** if the printer is not detected (see below — usually once per PC).
5. In Shopynn mobile: **More → Print agent** → enter this PC’s LAN IP → **Test connection** → Save.  
   On web: **Settings → Invoice & Receipt** → Print agent.
6. Set the warehouse printer type to **Thermal**.
7. Allow inbound TCP **3001** in Windows Firewall if phones print over Wi‑Fi.

Uninstall: use **Apps & features** / the Start Menu uninstaller, or run the bundled uninstall script.

#### Windows USB driver (Zadig / WinUSB)

Shopynn Print uses libusb (`escpos-usb`). Windows often binds thermal printers to **USBPRINT**, which blocks the agent. Install **WinUSB** once with [Zadig](https://zadig.akeo.ie/).

Do this when:
- Test connection says the agent is OK, but no USB printer is detected, or
- Printing fails with a USB / access / LIBUSB error.

Steps:
1. Plug in and power on the printer.
2. Download and run [Zadig](https://zadig.akeo.ie/) as Administrator.
3. **Options → List All Devices**.
4. Select the thermal printer (prefer the specific printer name over a generic composite device if both appear).
5. Choose driver **WinUSB** → **Install Driver** / **Replace Driver**.
6. Restart the Shopynn Print service (or reboot).
7. Test connection again from Shopynn.

The installer also:
- Shows these next steps on the finish page
- Offers checkboxes to open the USB guide and the Zadig website
- Installs `WINDOWS_USB_DRIVER.txt` into the app folder and Start Menu

After WinUSB is installed, Windows may stop listing the device as a normal printer — that is expected for Shopynn Print.

## Developer (local)

```bash
cd apps/print
npm install
npm start
# or: npm run dev
curl -s http://127.0.0.1:3001/health
```

Env:
- `PRINT_HOST` (default `0.0.0.0`)
- `PRINT_PORT` (default `3001`)

## Build packages

```bash
# macOS .pkg (must run on a Mac)
npm run package:mac -w @shopynn/print

# Windows: prepare bundle, then compile .iss on Windows with Inno Setup
npm run package:bundle:win -w @shopynn/print
# Open packaging/windows/shopynn-print.iss → Compile
# → packaging/dist/ShopynnPrintSetup-<version>.exe
```

Output lands in `apps/print/packaging/dist/` (gitignored).

## Troubleshooting
- **Not reachable from phone** — same Wi‑Fi, correct LAN IP, firewall allows 3001, agent bound to `0.0.0.0`.
- **No USB printer (Windows)** — install WinUSB with Zadig (see above); then restart the service.
- **No USB printer (macOS)** — check cable/power; macOS may need USB/printer permissions.
- **Service won’t start (Windows)** — reinstall as Administrator; check Event Viewer.
