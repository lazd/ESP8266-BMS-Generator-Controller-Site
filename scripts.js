const UPDATE_INTERVAL = 1000;
let updateTimeout;

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.addEventListener('load', () => {
      let object;
      try {
        object = JSON.parse(this.responseText);
        resolve(object);
      }
      catch (err) {
        reject(err);
      }
    });

    req.addEventListener('error', (evt) => {
      reject(evt);
    });

    req.addEventListener('abort', (evt) => {
      reject(evt);
    });

    req.open('GET', url);
    req.send();
  });
}

const batteryStatusMap = new Map([
  [-1, 'Offline'],
  [0, 'Standby'],
  [1, 'Charging'],
  [2, 'Discharging']
]);

function getPowerSourceEls(selector) {
  const powerSource = e.target.closest(selector);
  if (powerSource) {
    const info = powerSource.querySelector('.powerSource-info');
    const details = powerSource.querySelector('.powerSource-details');

    return { powerSource, info, details };
  }
  else {
    throw new Error(`Can't find power source with selector: ${selector}`);
  }
}

function setBatteryStatus(data) {
  const { powerSource, info, details } = getPowerSourceEls('.powerSource--battery')
  
  const batteryFillEl = powerSource.querySelector('.powerSource-chargeLevel');
  batteryFillEl.style.setProperty('--charge-level', data.packSOC);
  
  info.innerText = Math.floor(data.packSOC * 100) + '%';
  details.innerText = batteryStatusMap.get(data.chargeDischargeStatus);

  if (data.chargeDischargeStatus === 1) {
    powerSource.classList.add('is-charging');
    powerSource.classList.remove('is-charged');
  }
  else {
    powerSource.classList.add('is-charged');
    powerSource.classList.remove('is-charging');
  }
}

function setGeneratorStatus(data) {
  const { powerSource, info, details } = getPowerSourceEls('.powerSource--generator');

  if (data.generatorOn) {
    if (data.generatorStopRequested) {
      powerSource.classList.add('is-coolingDown');
      powerSource.classList.remove('is-off');
      info.innerText = 'Cooling down';
    }
    else {
      powerSource.classList.remove('is-off');
      powerSource.classList.remove('is-coolingDown');
      info.innerText = 'Running';
    }
  }
  else {
    powerSource.classList.add('is-off');
    powerSource.classList.remove('is-coolingDown');
    info.innerText = 'Off';
  }
}

function setGridStatus(data) {
  const { powerSource, info, details } = getPowerSourceEls('.powerSource--grid');

  if (data.gridPowerOn) {
    powerSource.classList.remove('is-off');
    info.innerText = 'On';
  }
  else {
    powerSource.classList.add('is-off');
    info.innerText = 'Off';
  }
}

const alarmMap = new Map([
  ['levelOneCellVoltageTooHigh', (data) => `Cell ${data.maxCellVNum} voltage too high (level 1): <strong>${data.maxCellmV}</strong>`],
  ['levelTwoCellVoltageTooHigh', (data) => `Cell ${data.maxCellVNum} voltage too high (level 2): <strong>${data.maxCellmV}</strong>`],
  ['levelTwoCellVoltageTooLow', (data) => `Cell ${data.minCellVNum} voltage too low (level 2): <strong>${data.minCellmV}</strong>`],
  ['levelTwoCellVoltageTooLow', (data) => `Cell ${data.minCellVNum} voltage too low (level 2): <strong>${data.minCellmV}</strong>`],
]);

function parseAlarm(alarm, data) {
  const alarmFunc = alarmMap.get(alarm);
  if (alarmFunc) {
    return alarmFunc(data);
  }
  const convertedAlarm = alarm.replace(/([A-Z])/g, ' $1');
  return convertedAlarm.charAt(0).toUpperCase() + convertedAlarm.slice(1);
}

function showAlarms(data) {
  let infoSectionEntires = document.querySelector('.infoSection--alarms .infoSection-entries');
  infoSectionEntires.innerHTML = '';
  if (data.alarms) {
    for (let alarm in data.alarms) {
      infoSectionEntires.innerHTML += `<li>${parseAlarm(alarm)}<li>\n`;
    }
  }
}

function showInfo(data) {}

function updateUI(data) {
  setBatteryStatus(data);
  setGridStatus(data);
  setGeneratorStatus(data);
  showAlarms(data);
  showInfo(data);
}

async function fetchUpdate() {
  clearTimeout(updateTimeout)

  let data;
  try {
    data = await getJSON('/api/data.json');
  }
  catch(err) {
    console.error(err);
    return;
  }

  updateUI(data);

  setTimeout(updateUI, UPDATE_INTERVAL);
}

updateUI();
