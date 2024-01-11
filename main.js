//
// ================== JuNeDNS No-IP ===================
//
// Copyright (c) 2024 Eduardo Ruiz <eruiz@dataclick.es>
// https://github.com/EduardoRuizM/junedns-noip
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE

// Install dependencies: npm install electron electron-packager --save-dev

const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const url = require('url');
const path = require('path');
const { execSync } = require('child_process');

const backend_url = ''; // Do not end with /

let win, cfg = {};
const fcfg = process.cwd() + path.sep + 'junedns-noip.conf';

try {

  fs.readFileSync(fcfg).toString().replace(/\r/g, '').split('\n').map(c => c).forEach(l => {
    l = l.split('=');
    if(l.length === 2)
      cfg[l[0].trim()] = l[1].trim();
  });

} catch(err) {}

function createWindow() {
  win = new BrowserWindow({width: 520, height: 310, webPreferences: {preload: path.join(__dirname, 'preload.js')}})
  win.loadURL(url.format({pathname: path.join(__dirname, 'index.html'), protocol: 'file:', slashes: true}));
  win.setMenuBarVisibility(false);
  win.setSize(520, 310);
  win.setResizable(false);
  win.center();
  win.setIcon(path.join(__dirname, 'favicon.ico'));
}

app.on('window-all-closed', () => {
  if(process.platform !== 'darwin')
    app.quit();
});

app.whenReady().then(() => {
  ipcMain.handle('getConfig', getConfig);
  ipcMain.handle('saveCode', saveCode);
  ipcMain.handle('sendCode', sendCode);
  createWindow();
  app.on('activate', function() {
    if(BrowserWindow.getAllWindows().length === 0)
      createWindow();
  })
});

let stask = taskExists();
function getConfig() {
  return {c: cfg.code || '', p: process.platform, t: stask, d: process.argv[0]};
}

function saveCode(ev, code, task) {
  let c = (!backend_url && cfg.backend_url) ? `backend_url=${cfg.backend_url}\n` : '';
  code = code.trim();
  if(code !== '')
    c = `${c}code=${code}\n`;

  fs.writeFileSync(fcfg, c);

  if(task !== stask) {
    if(task)
      taskCreate();
    else
      taskDelete();
  }

  stask = task;
}

function sendCode(ev, code) {
  fetch((backend_url || cfg.backend_url) + `/noip/${code}`);
}

if(process.argv[process.argv.length - 1] === 'update' && cfg.code) {
  sendCode(null, cfg.code);
  process.exit();
}

function taskExists() {
  try {
    let p;
    switch(process.platform) {
      case 'win32':
	return execSync('schtasks /query /tn JuNeDNS-NoIP 2>&1').toString().includes('JuNeDNS-NoIP');
	break;
      case 'linux':
	p = execSync('echo $HOME').toString().trim();
	return fs.existsSync(`${p}/.bash_profile`) && fs.readFileSync(`${p}/.bash_profile`).toString().includes('junedns-noip');
	break;
      case 'darwin':
	p = execSync('echo $HOME').toString().trim();
	return fs.existsSync(`${p}/Library/LaunchAgents/JuNeDNS-NoIP.plist`);
	break;
    }
  } catch(e) {
    return false;
  }
}

function taskDelete() {
  let p;
  switch(process.platform) {
    case 'win32':
      execSync('schtasks /delete /tn JuNeDNS-NoIP /f');
      break;
    case 'linux':
      p = execSync('echo $HOME').toString().trim();
      execSync(`sed '/junedns/d' ${p}/.bash_profile > ${p}/jdn_bash_profile.tmp && mv -f ${p}/jdn_bash_profile.tmp ${p}/.bash_profile`);
      break;
    case 'darwin':
      p = execSync('echo $HOME').toString().trim();
      fs.unlinkSync(`${p}/Library/LaunchAgents/JuNeDNS-NoIP.plist`);
      break;
  }
}

function taskCreate() {
  let p;
  switch(process.platform) {
    case 'win32':
      fs.writeFileSync(`${__dirname}/JuNeDNS-NoIP.xml`, `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>JuNeDNS No-IP - Update IP</Description>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
    <SessionStateChangeTrigger>
      <Enabled>true</Enabled>
      <StateChange>SessionUnlock</StateChange>
    </SessionStateChangeTrigger>
    <CalendarTrigger>
      <Repetition>
        <Interval>PT3H</Interval>
        <Duration>P1D</Duration>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>${(new Date()).toISOString().split('T')[0]}T00:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>true</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>true</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"${process.argv[0]}"</Command>
      <Arguments>update</Arguments>
    </Exec>
  </Actions>
</Task>`);
      execSync(`schtasks /create /tn JuNeDNS-NoIP /XML ${__dirname}\\JuNeDNS-NoIP.xml`);
      fs.unlinkSync(`${__dirname}/JuNeDNS-NoIP.xml`);
      break;
    case 'linux':
      p = execSync('echo $HOME').toString().trim();
      if(fs.existsSync(`${p}/.bash_profile`))
	fs.appendFileSync(`${p}/.bash_profile`, `${process.argv[0]} update\n`);
      else
	fs.writeFileSync(`${p}/.bash_profile`, `${process.argv[0]} update\n`);
      break;
    case 'darwin':
      p = execSync('echo $HOME').toString().trim();
      fs.writeFileSync(`${p}/Library/LaunchAgents/JuNeDNS-NoIP.plist`, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>JuNeDNS-NoIP</string>
    <key>ProgramArguments</key>
    <array>
      <string>sh</string>
      <string>-c</string>
      <string>${process.argv[0]} update</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>10800</integer>
  </dict>
</plist>`);
      execSync('launchctl load -w ~/Library/LaunchAgents/JuNeDNS-NoIP.plist');
      break;
  }
}
