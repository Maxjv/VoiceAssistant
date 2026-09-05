[Setup]
AppName=AnywhereDesign
AppVersion=1.0
AppPublisher=TFTE
DefaultDirName={%USERPROFILE}\AnywhereDesign
OutputDir=.\Output
OutputBaseFilename=Instalar_AnywhereDesign
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
Uninstallable=yes
CloseApplications=no
RestartApplications=no
DisableDirPage=no 
DisableProgramGroupPage=yes
DisableReadyPage=yes
SetupLogging=yes
LicenseFile=licencia.txt 
SetupIconFile=dist_production\app.ico 
VersionInfoDescription=AnywhereDesign Installer
VersionInfoProductName=AnywhereDesign
VersionInfoCompany=TFTE
VersionInfoVersion=1.0.0.0

[Files]
Source: "dist_production\AnywhereDesignServer.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\node.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\cloudflared.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\watchdog.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\launcher.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\launch.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\rescue.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\rescue.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\Tfte_Rescue_Panel.pyw"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\watcher\*"; DestDir: "{app}\watcher"; Flags: ignoreversion recursesubdirs
Source: "dist_production\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs
Source: "dist_production\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs
Source: "dist_production\app.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\Anywhere Design"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-WindowStyle Hidden -ExecutionPolicy Bypass -File .\launcher.ps1"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"
Name: "{autoprograms}\Anywhere Design"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-WindowStyle Hidden -ExecutionPolicy Bypass -File .\launcher.ps1"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"
Name: "{autodesktop}\Modo Rescate Anywhere Design"; Filename: "{app}\Tfte_Rescue_Panel.pyw"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\watcher"
Type: filesandordirs; Name: "{app}\public"
Type: files; Name: "{app}\.env"
Type: files; Name: "{app}\current-url.txt"
Type: files; Name: "{app}\launcher.ps1"
Type: files; Name: "{app}\watchdog.ps1"
Type: files; Name: "{app}\launch.bat"
Type: files; Name: "{app}\rescue.bat"
Type: files; Name: "{app}\rescue.ps1"
Type: files; Name: "{app}\Tfte_Rescue_Panel.pyw"
Type: files; Name: "{app}\*.log"
Type: files; Name: "{app}\stop.txt"
Type: files; Name: "{app}\.tfte_license.json"
Type: files; Name: "{app}\start_react_temp.bat"
Type: files; Name: "{app}\app.ico"
Type: filesandordirs; Name: "{app}"

[Code]
var
  EmailPage: TInputQueryWizardPage;
  ProjectNamePage: TInputQueryWizardPage;
  ContextPage: TInputDirWizardPage;
  ApiKeyPage: TWizardPage;
  ApiKeyEdit: TEdit;
  ApiKeyLabel: TLabel;
  BtnGetApiKey: TButton;
  UserApiKey: String;

function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Exec('cmd.exe', '/c taskkill /f /im cloudflared.exe /im AnywhereDesignServer.exe /im node.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := True;
end;

procedure BtnGetApiKeyClick(Sender: TObject);
var
  Dummy: Integer;
begin
  ShellExec('open', 'https://console.groq.com/keys', '', '', SW_SHOWNORMAL, ewNoWait, Dummy);
end;

procedure InitializeWizard;
begin
  EmailPage := CreateInputQueryPage(wpSelectDir,
    'Configuracion de Acceso',
    'Identificacion del Usuario',
    'Introduce tu correo o identificador.');
  EmailPage.Add('Tu Identificador:', False);
  EmailPage.Values[0] := 'usuario@tfte.com';

  ProjectNamePage := CreateInputQueryPage(EmailPage.ID,
    'Nombre del Proyecto',
    'Personaliza tu Asistente',
    'Introduce el nombre de la aplicacion que vas a diseñar.');
  ProjectNamePage.Add('Nombre del Proyecto:', False);
  ProjectNamePage.Values[0] := 'Mi Proyecto';

  ContextPage := CreateInputDirPage(ProjectNamePage.ID,
    'Carpeta de Trabajo', 'Selecciona el entorno de trabajo',
    'Pulsa "Examinar" para buscar la carpeta de tu proyecto. El sistema detectara si es React o Web automáticamente.',
    False, '');
  ContextPage.Add('');
  ContextPage.Values[0] := 'C:\';

  ApiKeyPage := CreateCustomPage(ContextPage.ID, 'Credenciales de Inteligencia Artificial', 'Obten tu Groq API Key gratuita para continuar.');
  ApiKeyLabel := TLabel.Create(ApiKeyPage);
  ApiKeyLabel.Parent := ApiKeyPage.Surface;
  ApiKeyLabel.Caption := '1. Haz clic en el boton para abrir la consola de Groq e iniciar sesion:' + #13#10 +
                         '2. Copia tu API Key (empieza por gsk_...)' + #13#10 +
                         '3. Pegala en el recuadro de abajo:';
  ApiKeyLabel.Left := 10;
  ApiKeyLabel.Top := 15;
  ApiKeyLabel.Width := 380;
  ApiKeyLabel.Height := 50;

  BtnGetApiKey := TButton.Create(ApiKeyPage);
  BtnGetApiKey.Parent := ApiKeyPage.Surface;
  BtnGetApiKey.Caption := '🔗 Obtener Groq API Key Gratis';
  BtnGetApiKey.Left := 10;
  BtnGetApiKey.Top := 80;
  BtnGetApiKey.Width := 220;
  BtnGetApiKey.Height := 30;
  BtnGetApiKey.OnClick := @BtnGetApiKeyClick;

  ApiKeyEdit := TEdit.Create(ApiKeyPage);
  ApiKeyEdit.Parent := ApiKeyPage.Surface;
  ApiKeyEdit.Left := 10;
  ApiKeyEdit.Top := 150;
  ApiKeyEdit.Width := 380;
  ApiKeyEdit.PasswordChar := '*';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  if CurPageID = EmailPage.ID then
  begin
    if Trim(EmailPage.Values[0]) = '' then
    begin
      MsgBox('El identificador es obligatorio.', mbError, MB_OK);
      Result := False;
    end;
  end;

  if CurPageID = ProjectNamePage.ID then
  begin
    if Trim(ProjectNamePage.Values[0]) = '' then
    begin
      MsgBox('El nombre del proyecto es obligatorio.', mbError, MB_OK);
      Result := False;
    end;
  end;

  if CurPageID = ContextPage.ID then
  begin
    if not DirExists(Trim(ContextPage.Values[0])) then
    begin
      MsgBox('Por favor, selecciona una carpeta valida usando el boton Examinar.', mbError, MB_OK);
      Result := False;
    end;
  end;

  if CurPageID = ApiKeyPage.ID then
  begin
    UserApiKey := Trim(ApiKeyEdit.Text);
    if (UserApiKey = '') or (Pos('gsk_', UserApiKey) <> 1) then
    begin
      MsgBox('Por favor, introduce una Groq API Key valida.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvContent: String;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    EnvContent := 'PORT=4000' + #13#10 +
                  'PROJECT_ROOT=' + ExpandConstant('{app}') + #13#10 +
                  'CONTEXT_PATH=' + Trim(ContextPage.Values[0]) + #13#10 +
                  'PROJECT_NAME=' + Trim(ProjectNamePage.Values[0]) + #13#10 +
                  'USER_EMAIL=' + Trim(EmailPage.Values[0]) + #13#10 +
                  'GROQ_API_KEY=' + UserApiKey + #13#10 +
                  'ACCESS_PIN=1234' + #13#10 +
                  'SMTP_HOST=smtp.gmail.com' + #13#10 +
                  'SMTP_PORT=587' + #13#10 +
                  'SMTP_USER=tfte.voiceassist@gmail.com' + #13#10 +
                  'SMTP_PASS=lgvfryvfniklizay' + #13#10 +
                  'SUPABASE_URL=https://anpqlsxazrrbejubview.supabase.co' + #13#10 +
                  'SUPABASE_ANON_KEY=sb_publishable_Ssd5fsrgT5fJ-UKFUt9w-Q_brwm41v0' + #13#10 +
                  'ENV=production';
    SaveStringToFile(ExpandConstant('{app}\.env'), EnvContent, False);

    // 1. Instalar dependencias del proyecto del usuario si tiene package.json y falta node_modules
    if FileExists(AddBackslash(Trim(ContextPage.Values[0])) + 'package.json') then
    begin
      if not DirExists(AddBackslash(Trim(ContextPage.Values[0])) + 'node_modules') then
      begin
        WizardForm.StatusLabel.Caption := 'Instalando dependencias de tu proyecto...';
        Exec('cmd.exe', '/c npm install', Trim(ContextPage.Values[0]), SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
    end;

    // 2. Registro silencioso de reglas en el Firewall de Windows (evita popup de alerta al usuario)
    WizardForm.StatusLabel.Caption := 'Configurando permisos de red seguros...';
    Exec('netsh.exe', ExpandConstant('advfirewall firewall add rule name="AnywhereDesign Cloudflared" dir=in action=allow program="{app}\cloudflared.exe" enable=yes profile=any'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('netsh.exe', ExpandConstant('advfirewall firewall add rule name="AnywhereDesign Server" dir=in action=allow program="{app}\AnywhereDesignServer.exe" enable=yes profile=any'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('netsh.exe', ExpandConstant('advfirewall firewall add rule name="AnywhereDesign Node" dir=in action=allow program="{app}\node.exe" enable=yes profile=any'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // 3. Levantar el sistema en segundo plano y esperar a que Cloudflare y el proyecto esten 100% listos (SIN ABRIR NAVEGADOR)
    WizardForm.StatusLabel.Caption := 'Iniciando AnywhereDesign y verificando conexion de Cloudflare...';
    Exec('powershell.exe', ExpandConstant('-ExecutionPolicy Bypass -WindowStyle Hidden -File "{app}\launcher.ps1" -WaitReadyOnly'), ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // 4. Mostrar el PIN cuando Cloudflare y el proyecto ya estan 100% listos
    MsgBox('¡Instalación completada con éxito!' + #13#10#13#10 +
           'AnywhereDesign está listo y tu proyecto se ha conectado correctamente.' + #13#10#13#10 +
           '🔒 Tu PIN de seguridad para acceder es: 1234' + #13#10#13#10 +
           'Haz clic en Aceptar para abrir la aplicación.', mbInformation, MB_OK);

    // 5. AHORA Y SOLO AHORA que el usuario dio Aceptar, abrir el navegador directo a la web
    Exec('powershell.exe', ExpandConstant('-ExecutionPolicy Bypass -WindowStyle Hidden -File "{app}\launcher.ps1" -OpenBrowserOnly'), ExpandConstant('{app}'), SW_HIDE, ewNoWait, ResultCode);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    SaveStringToFile(ExpandConstant('{app}\stop.txt'), 'stop', False);
    Sleep(1000);
    Exec('cmd.exe', '/c taskkill /f /im node.exe /im cloudflared.exe /im powershell.exe /im AnywhereDesignServer.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('netsh.exe', 'advfirewall firewall delete rule name="AnywhereDesign Cloudflared"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('netsh.exe', 'advfirewall firewall delete rule name="AnywhereDesign Server"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('netsh.exe', 'advfirewall firewall delete rule name="AnywhereDesign Node"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1000);
  end;
end;