[Setup]
AppName=AnywhereDesign
AppVersion=1.0
DefaultDirName={localappdata}\AnywhereDesign
OutputDir=.\Output
OutputBaseFilename=Instalar_AnywhereDesign
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
DisableDirPage=no 
LicenseFile=licencia.txt 

[Files]
Source: "dist_production\VoiceAssistant_TFTE.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\node.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\cloudflared.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\watchdog.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\rescue.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\rescue.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist_production\watcher\*"; DestDir: "{app}\watcher"; Flags: ignoreversion recursesubdirs
Source: "dist_production\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs
Source: "dist_production\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs

[Run]
Filename: "powershell.exe"; Parameters: "-WindowStyle Hidden -ExecutionPolicy Bypass -Command ""npm install -g @google/antigravity @anthropic-ai/claude-code --force"""; StatusMsg: "Descargando e instalando Agentes de IA en tu sistema..."; Flags: runhidden waituntilterminated

[Icons]
Name: "{autoprograms}\AnywhereDesign"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\launcher.ps1"""; IconFilename: "{app}\VoiceAssistant_TFTE.exe"
Name: "{userdesktop}\Modo Rescate AnywhereDesign"; Filename: "{app}\Tfte_Rescue_Panel.pyw"; IconFilename: "{app}\VoiceAssistant_TFTE.exe"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\watcher"
Type: files; Name: "{app}\.env"
Type: files; Name: "{app}\current-url.txt"
Type: files; Name: "{app}\launcher.ps1"
Type: files; Name: "{app}\*.log"
Type: files; Name: "{app}\stop.txt"
Type: files; Name: "{app}\.tfte_license.json"
Type: files; Name: "{app}\open_browser.ps1"
Type: files; Name: "{app}\start_react_temp.bat"
Type: files; Name: "{app}\Project_Control.html"
Type: filesandordirs; Name: "{app}\public"

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
  EnvContent, LauncherScript, OpenBrowserScript, WaitAppScript: String;
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

    // PRE-INSTALAR DEPENDENCIAS DEL PROYECTO INVISIBLEMENTE
    WizardForm.StatusLabel.Caption := 'Preparando dependencias de tu proyecto (esto puede tardar unos minutos)...';
    Exec('cmd.exe', '/c npm install', Trim(ContextPage.Values[0]), SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    // LANZADOR VISUAL INTEGRADO
    LauncherScript := '$Host.UI.RawUI.WindowTitle = "AnywhereDesign - Iniciando..."' + #13#10 +
                      'Write-Host ""' + #13#10 +
                      'Write-Host " ==================================================" -ForegroundColor Cyan' + #13#10 +
                      'Write-Host "        INICIANDO ANYWHEREDESIGN" -ForegroundColor White' + #13#10 +
                      'Write-Host " ==================================================" -ForegroundColor Cyan' + #13#10 +
                      'Write-Host ""' + #13#10 +
                      '$root = $PSScriptRoot' + #13#10 +
                      'if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }' + #13#10 +
                      'Write-Host " [1/3] Comprobando procesos activos..." -ForegroundColor Yellow' + #13#10 +
                      '$isAppRunning = Get-Process -Name "VoiceAssistant_TFTE" -ErrorAction SilentlyContinue' + #13#10 +
                      'if (-not $isAppRunning) {' + #13#10 +
                      '    Remove-Item (Join-Path $root "current-url.txt") -ErrorAction SilentlyContinue' + #13#10 +
                      '    Write-Host " [2/3] Levantando servidor y túnel seguro..." -ForegroundColor Yellow' + #13#10 +
                      '    Start-Process "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\watchdog.ps1`"" -WindowStyle Hidden' + #13#10 +
                      '}' + #13#10 +
                      'Write-Host " [3/3] Enganchando el túnel de Cloudflare..." -ForegroundColor Yellow' + #13#10 +
                      '$counter = 0; $url = $null' + #13#10 +
                      'while ($counter -lt 30) {' + #13#10 +
                      '    $counter++' + #13#10 +
                      '    Start-Sleep -Seconds 2' + #13#10 +
                      '    if (Test-Path (Join-Path $root "current-url.txt")) {' + #13#10 +
                      '        $content = Get-Content (Join-Path $root "current-url.txt")' + #13#10 +
                      '        if ($content -match "trycloudflare.com") { $url = $content; break }' + #13#10 +
                      '    }' + #13#10 +
                      '}' + #13#10 +
                      'if ($url) {' + #13#10 +
                      '    Write-Host " [EXITO] Túnel conectado." -ForegroundColor Cyan' + #13#10 +
                      '} else {' + #13#10 +
                      '    Write-Host " [ERROR] Tiempo de espera agotado para Cloudflare." -ForegroundColor Red' + #13#10 +
                      '}';
    SaveStringToFile(ExpandConstant('{app}\launcher.ps1'), LauncherScript, False);

    // SCRIPT ROBUSTO PARA ABRIR NAVEGADOR (CON PAUSA DE 8 SEGUNDOS)
    OpenBrowserScript := '$root = $PSScriptRoot' + #13#10 +
                         'Start-Sleep -Seconds 8' + #13#10 +
                         '$urlPath = Join-Path $root "current-url.txt"' + #13#10 +
                         'if (Test-Path $urlPath) { $url = Get-Content $urlPath } else { exit }' + #13#10 +
                         '$context = ""' + #13#10 +
                         '$envPath = Join-Path $root ".env"' + #13#10 +
                         'if (Test-Path $envPath) {' + #13#10 +
                         '    $match = Get-Content $envPath | Where-Object { $_ -match "^CONTEXT_PATH=(.*)$" }' + #13#10 +
                         '    if ($match) { $context = $match -replace "^CONTEXT_PATH=","" }' + #13#10 +
                         '}' + #13#10 +
                         'Start-Process "$url/?context=$context"';
    SaveStringToFile(ExpandConstant('{app}\open_browser.ps1'), OpenBrowserScript, False);

    // Ejecutar el lanzador (Cloudflare) y esperar a que termine de conectar
    Exec('powershell.exe', ExpandConstant('-ExecutionPolicy Bypass -WindowStyle Hidden -File "{app}\launcher.ps1"'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // NUEVO: BLOQUEAR EL INSTALADOR HASTA QUE REACT/VITE COMPILE AL 100%
    WizardForm.StatusLabel.Caption := 'Compilando tu proyecto en segundo plano. Esto tomará un minuto...';
    
    WaitAppScript := '$url = "http://127.0.0.1:4000/api/check-target"' + #13#10 +
                     '$counter = 0' + #13#10 +
                     'while ($counter -lt 60) {' + #13#10 +
                     '    try {' + #13#10 +
                     '        $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop' + #13#10 +
                     '        if ($response.ready -eq $true) { break }' + #13#10 +
                     '    } catch { }' + #13#10 +
                     '    $counter++' + #13#10 +
                     '    Start-Sleep -Seconds 2' + #13#10 +
                     '}';
    SaveStringToFile(ExpandConstant('{app}\wait_app.ps1'), WaitAppScript, False);
    
    // Esta línea congela la barra del instalador hasta que el script termine
    Exec('powershell.exe', ExpandConstant('-ExecutionPolicy Bypass -WindowStyle Hidden -File "{app}\wait_app.ps1"'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    MsgBox('¡Instalación completada con éxito!' + #13#10#13#10 +
           'El Asistente ha detectado tu proyecto y está listo para funcionar.' + #13#10#13#10 +
           '🔒 IMPORTANTE: El PIN de seguridad para acceder a la interfaz es: 1234' + #13#10#13#10 +
           'Al presionar Aceptar, se abrirá tu navegador web automáticamente.', mbInformation, MB_OK);

    // Lanzar el navegador inmediatamente al cerrar el Popup
    Exec('powershell.exe', ExpandConstant('-ExecutionPolicy Bypass -WindowStyle Hidden -File "{app}\open_browser.ps1"'), '', SW_HIDE, ewNoWait, ResultCode);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    SaveStringToFile(ExpandConstant('{app}\stop.txt'), 'stop', False);
    Sleep(2000);
    Exec('cmd.exe', '/c taskkill /f /im node.exe /im cloudflared.exe /im powershell.exe /im VoiceAssistant_TFTE.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1000);
  end;
end;