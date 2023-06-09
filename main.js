// Get references to UI elements
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');
let deviceName = document.getElementById('device');
// Selected device object cache
let deviceCache = null;
// Characteristic object cache
let characteristicCache = null;
// Intermediate buffer for incoming data
let readBuffer = '';
// Menu buttons
let comboB = document.getElementById('comboButton');
let fastB = document.getElementById('fastButton');
let workoutB = document.getElementById('workoutButton');
// Menu Content
let comboM = document.getElementById('comboM');
let fastM = document.getElementById('fastM');
let workoutM = document.getElementById('workoutM');
//Combo form
let comboValue = document.getElementById('comboValue').value;
let rndTime = document.getElementById('rndTime');
let rndNmb = document.getElementById('rndNb');
let goCombo = document.getElementById('goCombo');
// Initial Value for arduino
let isSound = 0;
let mode = 1;
let timeBetween = 200;

// Handle form submit event
sendForm.addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent form sending
  send(inputField.value); // Send text field contents
  inputField.value = '';  // Zero text field
  inputField.focus();     // Focus on text field
});

//Submit Combo form
goCombo.addEventListener('click', function(event) {
  const buffer = String(comboValue+','+rndTime.value +','+isSound+','+mode+''+rndNmb.value+','+timeBetween);
  event.preventDefault(); // Prevent form sending
  send(buffer); // Send text field contents
  console.log("message send "+ buffer);
  // comboValue.value = '';  // Zero text field
  // rndNmb.value = '';  // Zero text field
  // rndTime.value = '';  // Zero text field
});

// MEnu event
comboB.addEventListener('click', function() {
  comboM.hidden =false;
  fastM.hidden =true;
  workoutM.hidden =true;
});
fastB.addEventListener('click', function() {
  comboM.hidden =true;
  fastM.hidden =false;
  workoutM.hidden =true;
});
workoutB.addEventListener('click', function() {
  comboM.hidden =true;
  fastM.hidden =true;
  workoutM.hidden =false;
});
// Connect to the device on Connect button click
connectButton.addEventListener('click', function() {
  connect();
});

// Disconnect from the device on Disconnect button click
disconnectButton.addEventListener('click', function() {
  disconnect();
});


// Launch Bluetooth device chooser and connect to the selected
function connect() {
    return (deviceCache ? Promise.resolve(deviceCache) :
    requestBluetoothDevice()).
    then(device => connectDeviceAndCacheCharacteristic(device)).
    then(characteristic => startNotifications(characteristic)).
    catch(error => log(error));
}

// Disconnect from the connected device
function disconnect() {
  if (deviceCache) {
    log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
    deviceCache.removeEventListener('gattserverdisconnected',
        handleDisconnection);

    if (deviceCache.gatt.connected) {
      deviceCache.gatt.disconnect();
      log('"' + deviceCache.name + '" bluetooth device disconnected');
      disconnectButton.hidden = true;
      connectButton.hidden = false;
      connectButton.style.color = "blue";
      document.getElementById("device").innerHTML = "Not connected";
    }
    else {
      log('"' + deviceCache.name +
          '" bluetooth device is already disconnected');
    }
  }
  if (characteristicCache) {
    characteristicCache.removeEventListener('characteristicvaluechanged',
        handleCharacteristicValueChanged);
    characteristicCache = null;
  }

  deviceCache = null;
}

// Data receiving
function handleCharacteristicValueChanged(event) {
  let value = new TextDecoder().decode(event.target.value);
  for (let c of value) {
    if (c === '\n') {
      let data = readBuffer.trim();
      readBuffer = '';

      if (data) {
        receive(data);
      }
    }
    else {
      readBuffer += c;
    }
  }
}

// Received data handling
function receive(data) {
  log(data, 'in');
}

// Send data to the connected device
function send(data) {
  data = String(data);

  if (!data || !characteristicCache) {
    return;
  }

  data += '\n';

  if (data.length > 20) {
    let chunks = data.match(/(.|[\r\n]){1,20}/g);

    writeToCharacteristic(characteristicCache, chunks[0]);

    for (let i = 1; i < chunks.length; i++) {
      setTimeout(() => {
        writeToCharacteristic(characteristicCache, chunks[i]);
      }, i * 100);
    }
  }
  else {
    writeToCharacteristic(characteristicCache, data);
  }

  log(data, 'out');
}

function writeToCharacteristic(characteristic, data) {
  characteristic.writeValue(new TextEncoder().encode(data));
}

function requestBluetoothDevice() {
    log('Requesting bluetooth device...');

    return navigator.bluetooth.requestDevice({
        filters: [{services: [0xFFE0]}],
    }).
        then(device => {
            log('"' + device.name + '" bluetooth device selected');
            deviceCache = device;

            deviceCache.addEventListener('gattserverdisconnected',
            handleDisconnection);
            document.getElementById("device").innerHTML = "Connected to " +device.name;
            disconnectButton.hidden =false;
            connectButton.hidden =true;
            disconnectButton.style.color = "red";
            return deviceCache;
        });
  }

function handleDisconnection(event) {
  let device = event.target;
  log('"' + device.name +
      '" bluetooth device disconnected, trying to reconnect...');
  connectDeviceAndCacheCharacteristic(device).
      then(characteristic => startNotifications(characteristic)).
      catch(error => log(error));
}

// Connect to the device specified, get service and characteristic
function connectDeviceAndCacheCharacteristic(device) {
    if (device.gatt.connected && characteristicCache) {
      return Promise.resolve(characteristicCache);
    }
  
    log('Connecting to GATT server...');
  
    return device.gatt.connect().
        then(server => {
          log('GATT server connected, getting service...');
  
          return server.getPrimaryService(0xFFE0);
        }).
        then(service => {
          log('Service found, getting characteristic...');
  
          return service.getCharacteristic(0xFFE1);
        }).
        then(characteristic => {
          log('Characteristic found');
          characteristicCache = characteristic;
  
          return characteristicCache;
        });
}

// Enable the characteristic changes notification
function startNotifications(characteristic) {
    log('Starting notifications...');
  
    return characteristic.startNotifications().
        then(() => {
          log('Notifications started');
          // Added line
          characteristic.addEventListener('characteristicvaluechanged',
          handleCharacteristicValueChanged);
        });
}

// Output to terminal
function log(data, type = '') {
    terminalContainer.insertAdjacentHTML('beforeend',
        '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
}