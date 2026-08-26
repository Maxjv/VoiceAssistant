[Setup]
AppName=TFTE Voice Assistant
AppVersion=1.0
DefaultDirName={localappdata}\TFTE\VoiceAssistant
OutputDir=.\Output
OutputBaseFilename=Instalar_Asistente_TFTE
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
DisableDirPage=yes 
LicenseFile=licencia.txt 

[Files]
Source: "VoiceAssistant_TFTE.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "cloudflared.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "watchdog.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "watcher\*"; DestDir: "{app}\watcher"; Flags: ignoreversion recursesubdirs
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{autoprograms}\TFTE Voice Assistant"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\launcher.ps1"""; IconFilename: "{app}\VoiceAssistant_TFTE.exe"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\watcher"
Type: files; Name: "{app}\.env"
Type: files; Name: "{app}\current-url.txt"
Type: files; Name: "{app}\launcher.ps1"
Type: files; Name: "{app}\*.log"
Type: files; Name: "{app}\stop.txt"

[Code]
var
  EmailPage: TInputQueryWizardPage;
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

  ContextPage := CreateInputDirPage(EmailPage.ID,
    'Carpeta de Trabajo', 'Selecciona el entorno de trabajo',
    'Pulsa "Examinar" para buscar la carpeta de tu proyecto. El sistema detectara la raiz de React automaticamente.',
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
  EnvContent, LauncherScript: String;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    EnvContent := 'PORT=4000' + #13#10 +
                  'PROJECT_ROOT=' + ExpandConstant('{app}') + #13#10 +
                  'CONTEXT_PATH=' + Trim(ContextPage.Values[0]) + #13#10 +
                  'USER_EMAIL=' + Trim(EmailPage.Values[0]) + #13#10 +
                  'GROQ_API_KEY=' + UserApiKey + #13#10 +
                  'ACCESS_PIN=1234';
    SaveStringToFile(ExpandConstant('{app}\.env'), EnvContent, False);

    // LANZADOR VISUAL INTEGRADO
    LauncherScript := '$Host.UI.RawUI.WindowTitle = "TFTE Voice Assistant - Iniciando..."' + #13#10 +
                      'Write-Host ""' + #13#10 +
                      'Write-Host " ==================================================" -ForegroundColor Cyan' + #13#10 +
                      'Write-Host "        INICIANDO TFTE VOICE ASSISTANT" -ForegroundColor White' + #13#10 +
                      'Write-Host " ==================================================" -ForegroundColor Cyan' + #13#10 +
                      'Write-Host ""' + #13#10 +
                      '$root = $PSScriptRoot' + #13#10 +
                      'if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }' + #13#10 +
                      'Write-Host " [1/4] Comprobando procesos activos..." -ForegroundColor Yellow' + #13#10 +
                      '$isAppRunning = Get-Process -Name "VoiceAssistant_TFTE" -ErrorAction SilentlyContinue' + #13#10 +
                      'if (-not $isAppRunning) {' + #13#10 +
                      '    Remove-Item (Join-Path $root "current-url.txt") -ErrorAction SilentlyContinue' + #13#10 +
                      '    Write-Host " [2/4] Levantando servidor, app React y Watchdog..." -ForegroundColor Yellow' + #13#10 +
                      '    Start-Process "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\watchdog.ps1`"" -WindowStyle Hidden' + #13#10 +
                      '}' + #13#10 +
                      'Write-Host " [3/4] Enganchando el tunel de Cloudflare..." -ForegroundColor Yellow' + #13#10 +
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
                      '    Write-Host " [EXITO] Tunel conectado. Abriendo navegador..." -ForegroundColor Cyan' + #13#10 +
                      '    $context = ""' + #13#10 +
                      '    $envPath = Join-Path $root ".env"' + #13#10 +
                      '    if (Test-Path $envPath) {' + #13#10 +
                      '        $match = Get-Content $envPath | Where-Object { $_ -match "^CONTEXT_PATH=(.*)$" }' + #13#10 +
                      '        if ($match) { $context = $match -replace "^CONTEXT_PATH=","" }' + #13#10 +
                      '    }' + #13#10 +
                      '    Start-Process "$url/?context=$context"' + #13#10 +
                      '} else {' + #13#10 +
                      '    Write-Host " [ERROR] Fallo Cloudflare." -ForegroundColor Red' + #13#10 +
                      '}';
    SaveStringToFile(ExpandConstant('{app}\launcher.ps1'), LauncherScript, False);

    // Esperar a que el lanzador termine de obtener la URL de Cloudflare antes de mostrar el mensaje final
    Exec('powershell.exe', ExpandConstant('-ExecutionPolicy Bypass -WindowStyle Hidden -File "{app}\launcher.ps1"'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    MsgBox('¡Instalacion completada con exito!' + #13#10#13#10 +
           'El Asistente ya esta abriendo tu navegador. El proyecto tardara unos instantes en compilar en segundo plano.' + #13#10#13#10 +
           '🔒 IMPORTANTE: El PIN de seguridad para acceder a la interfaz es: 1234' + #13#10#13#10 +
           'En el futuro puedes abrir el Asistente buscando "TFTE Voice Assistant" en el Menu de Inicio de Windows.', mbInformation, MB_OK);
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