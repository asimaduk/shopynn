; Shopynn Print — Inno Setup script
; Build on Windows with Inno Setup Compiler after:
;   bash packaging/bundle/prepare-bundle.sh win
; or copy a prepared packaging/dist/bundle-win folder onto the Windows build machine.

#define MyAppName "Shopynn Print"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Shopynn"
#define MyAppURL "https://shopynn.com"
#define BundleDir "..\dist\bundle-win"

[Setup]
AppId={{A7C3E2F1-9B4D-4E8A-9C1F-SHOPYNNPRINT01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\Shopynn Print
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=ShopynnPrintSetup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
InfoAfterFile=after-install.txt

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
FinishedLabel=Setup has finished installing Shopynn Print.%n%nIf the USB printer is not detected, install WinUSB with Zadig (see the USB driver guide). Then set this PC's LAN IP in Shopynn Print agent settings.

[Files]
Source: "{#BundleDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "install-service.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall-service.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "WINDOWS_USB_DRIVER.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "after-install.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Shopynn Print (install folder)"; Filename: "{app}"
Name: "{group}\USB driver guide (Zadig / WinUSB)"; Filename: "{app}\WINDOWS_USB_DRIVER.txt"
Name: "{group}\Uninstall Shopynn Print"; Filename: "{uninstallexe}"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install-service.ps1"" -InstallDir ""{app}"""; StatusMsg: "Installing Windows service..."; Flags: runhidden waituntilterminated
Filename: "{app}\WINDOWS_USB_DRIVER.txt"; Description: "View USB driver instructions (WinUSB / Zadig)"; Flags: postinstall shellexec skipifsilent
Filename: "{cmd}"; Parameters: "/c start https://zadig.akeo.ie/"; Description: "Open Zadig download website"; Flags: postinstall shellexec skipifsilent unchecked

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\uninstall-service.ps1"""; RunOnceId: "UninstallShopynnPrintSvc"; Flags: runhidden waituntilterminated
