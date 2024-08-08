const UPDATE_INTERVAL = 2000;
let updateTimeout;

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.timeout = 5000;
    req.addEventListener('load', () => {
      let object;
      try {
        object = JSON.parse(req.responseText);
        resolve(object);
      }
      catch (err) {
        reject(err);
      }
    });

    req.addEventListener('error', (evt) => {
      reject(new Error('Request failed'));
    });

    req.addEventListener('abort', (evt) => {
      reject(new Error('Request aborted'));
    });

    req.addEventListener('timeout', (evt) => {
      reject(new Error('Request timed out'));
    });

    req.open('GET', url);
    req.send();
  });
}

const batteryStatusMap = new Map([
  ['Stationary', 'Standby'],
  ['Charge', 'Charging'],
  ['Discharge', 'Discharging']
]);

function getPowerSourceEls(selector) {
  const powerSource = document.querySelector(selector);
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
  
  if (data.bmsCommunicationStatus) {
    powerSource.classList.add('is-on');
    powerSource.classList.remove('is-off');
  }
  else {
    powerSource.classList.add('is-off');
    powerSource.classList.remove('is-on');
    return;
  }

  const batteryFillEl = powerSource.querySelector('.powerSource-chargeLevel');
  batteryFillEl.style.setProperty('--charge-level', data.packSOC / 100);
  
  info.innerText = Math.floor(data.packSOC) + '%';
  details.innerText = batteryStatusMap.get(data.chargeDischargeStatus);

  if (data.chargeDischargeStatus === 'Charge') {
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

function setInverterStatus(data) {
  const { powerSource, info, details } = getPowerSourceEls('.powerSource--inverter');

  if (data.inverterOn) {
    powerSource.classList.remove('is-off');
    info.innerText = 'On';
  }
  else {
    powerSource.classList.add('is-off');
    info.innerText = 'Off';
  }
}

const alarmMap = new Map([
  ['levelOneCellVoltageTooHigh', (data) => `Cell ${data.maxCellVNum} voltage too high (level 1): <strong>${data.maxCellmV / 1000}V</strong>`],
  ['levelTwoCellVoltageTooHigh', (data) => `Cell ${data.maxCellVNum} voltage too high (level 2): <strong>${data.maxCellmV / 1000}V</strong>`],
  ['levelTwoCellVoltageTooLow', (data) => `Cell ${data.minCellVNum} voltage too low (level 2): <strong>${data.minCellmV / 1000}V</strong>`],
  ['levelTwoCellVoltageTooLow', (data) => `Cell ${data.minCellVNum} voltage too low (level 2): <strong>${data.minCellmV / 1000}V</strong>`],
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
  let alarmInfoSection = document.querySelector('.infoSection--alarms');
  let infoSectionEntires = alarmInfoSection.querySelector('.infoSection-entries');
  if (data.alarms && Object.values(data.alarms).filter(Boolean).length != 0) {
    alarmInfoSection.removeAttribute('hidden');

    const entryHTML = [];
    for (let alarm in data.alarms) {
      if (data.alarms[alarm]) {
        entryHTML.push(`<li>${parseAlarm(alarm, data)}</li>\n`);
      }
    }
    infoSectionEntires.innerHTML = entryHTML.join('\n');
}
  else {
    alarmInfoSection.setAttribute('hidden', '');
  }
}

const infoEntries = [
  ['packSOC', 'Charge Level', v => Math.floor(v) + '%'],
  ['packVoltage', 'Wattage', (v, data) => `${(v * data.packCurrent / 1000).toLocaleString()}kW`],
  ['packVoltage', 'Voltage', v => `${v.toLocaleString()}V`],
  ['packCurrent', 'Current', v => v.toLocaleString() + 'A'],
  ['resCapacitymAh', 'Capacity', v => `${(v / 1000).toLocaleString()}Ah`],
  ['runTimeHours', 'Run time', v => {
    const d = new Date(0,0);
    d.setSeconds(parseFloat(v) * 60 * 60);
    return d.toTimeString().slice(0, 6);
  }],
  ['tempAverage', 'Temperature', v => `${(v * 9/5 + 32).toFixed(1)}°F`],
  ['cellDiff', 'Cell ΔV', v => `${(v / 1000).toLocaleString()}V`],
  ['bmsCycles', 'Cycles', v => v.toLocaleString()],
  ['cellBalanceActive', 'Balancing', v => v ? 'Yes' : 'No'],
  ['cellVoltages', 'Cells', vs => '<table><tr>' + vs.map((v, i) => (v / 1000).toFixed(3) + 'V' + ((i+1 === (vs.length / 2)) ? '</tr><tr>' : '')).map(v => `<td>${v}</td>`).join(' ') + '</tr></table>'],
];

function showInfo(data) {
  let infoSection = document.querySelector('.infoSection--info');
  let infoSectionEntires = infoSection.querySelector('.infoSection-entries');
  infoSection.removeAttribute('hidden');

  const entryHTML = [];
  for (let [key, label, fn] of infoEntries) {
    if (data[key] === null || data[key] === undefined) {
      continue;
    }
    const value = typeof fn === 'function' ? fn(data[key], data) : data[key];
    entryHTML.push(`<li><span>${label}:</span><strong>${value}</strong></li>`);
  }
  infoSectionEntires.innerHTML = entryHTML.join('\n');
}

function updateUI(data) {
  setBatteryStatus(data);
  setGridStatus(data);
  setGeneratorStatus(data);
  setInverterStatus(data);
  showAlarms(data);
  showInfo(data);
}

async function fetchUpdate() {
  clearTimeout(updateTimeout)

  let data;
  try {
    data = await getJSON('/api/data.json');
    updateUI(data);
  }
  catch(err) {
    console.error(`Failed to fetch data:`, err);
  }

  setTimeout(fetchUpdate, UPDATE_INTERVAL);
}

fetchUpdate();
