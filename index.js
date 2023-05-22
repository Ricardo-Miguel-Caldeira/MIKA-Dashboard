require('dotenv').config()

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mqtt = require('mqtt');
const mysql = require('mysql');
const httpModule = require('http');
const fs = require('fs');
const path = require('path');

const staticDirectory = path.join(__dirname, '1920x1080');
app.use('/1920x1080', express.static(path.join(__dirname, '1920x1080')));

console.log(process.env.MYSQL_HOST)


// Configuration for connecting to the MySQL database
const db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
}); 

// Creation of the devices collection
const devices = new Map();

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }

  console.log('Connected to MySQL database');

  // Load all devices from the database into the collection
  db.query('SELECT tele_topic, name, state_field, imageUrl, power_level1, power_level2, power_level3 FROM devices WHERE enable = 1 AND tele_topic IS NOT NULL', (err, rows) => {
    if (err) {
      console.error('Error fetching devices from MySQL database:', err);
      return;
    }  

    rows.forEach((row) => {
        const device = {
          deviceId: row.tele_topic,
          deviceName: row.name,
          stateField: row.state_field,
          imageUrl: row.imageUrl,
          powerLevel1: row.power_level1,
          powerLevel2: row.power_level2,
          powerLevel3: row.power_level3,
          payload: "OFF"
        };
      
        // Check if the image exists
        checkImageExists(row.imageUrl, (exists) => {
          if (exists) {
            devices.set(row.name, device);
          } else {
            console.warn(`The image "${row.imageUrl}" does not exist. Using alternative image.`);
            device.imageUrl = '1920x1080/render.png'; // Specify the path to the alternative image
            devices.set(row.name, device); 
          }
        });
      });

    });
 
    // Start the MQTT server after loading the devices
    startMqttServer();
  });


  function checkImageExists(imagePath, callback) {
    fs.access(imagePath, fs.constants.F_OK, (err) => {
      if (!err) {
        callback(true); // The image exists
      } else {
        console.warn(`The image "${imagePath}" does not exist. Using alternative image.`);
        callback(false); // The image does not exist
      }
    });
  }

function startMqttServer() {
  // Configuration for the MQTT server
  const mqttClient = mqtt.connect(process.env.MQTT_SERVER, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
  });

  mqttClient.on('connect', () => {

    // Subscribe to topics for each device
    // TODO
    //devices.forEach((device, topic) => {
    //  mqttClient.subscribe(topic);
    //});

    mqttClient.subscribe('zigbee2mqtt/tasmota/+/tele/SENSOR');
    mqttClient.subscribe('zigbee2mqtt/lled/+');
    mqttClient.subscribe('zigbee2mqtt/switch/+');
    mqttClient.subscribe('zigbee2mqtt/wled/+/api');


  });

  mqttClient.on('message', (topic, message) => {
    
    // Find the device corresponding to the topic and send the information through the websocket
    // console.log(`Received message from device: ${topic.split('/')[2]} : ${message.toString()}`);

    deviceDomain = topic.split('/')[1]
    deviceId = topic.split('/')[2]

    const device = devices.get(topic.split('/')[2]);
    if (!device) return false

    if (deviceDomain !== "wled"){
      mqttMessage = JSON.parse(message);
    }else{
      mqttMessage = message;
    }
    
    //console.log(device.stateField)
    
    //  For each domain, we have a specific way of identifying whether the device is ON or not
    if (deviceDomain == "tasmota"){
        // This device is a Tasmota enabled device. Most probably has power metering
        // Each device has 3 levels of power to help us identifing the current state

        // console.log(`${deviceId} - ${message} ${mqttMessage.ENERGY}`);
        if ('ENERGY' in mqttMessage){
          
          // We conside ON if the Power is higher then powerLevel1 we will present the device.
          if (mqttMessage.ENERGY.Power > device.powerLevel1){
                //console.log(`${deviceId} is ON ${mqttMessage.ENERGY.Power}/${device.powerLevel1}`);
                device.payload = "ON";
            }else{
                device.payload = "OFF";
          }
        }
    }

    if (deviceDomain == "lled"){
        // This device is one led lamp

        //console.log(mqttMessage);
        if ('state' in mqttMessage){
            if (mqttMessage.state == "ON"){
                device.payload = "ON";
            }else{
                device.payload = "OFF";
            }
        }
    }

    if (deviceDomain == "switch"){
        // Device is a wall switch

        // This kind of device may have state_left and state_right status messages
        if ('state_l1' in mqttMessage && 'state_l2' in mqttMessage){
            
            //console.log(`${deviceId} has STATE L1 OR L2`);

            if ('state_l1' in mqttMessage && device.stateField == "state_l1"){
                //console.log(`${deviceId} STATE LEFT: ${mqttMessage.state_left}`);
                if (mqttMessage.state_l1 == "ON"){
                    device.payload = "ON";
                }else{
                    device.payload = "OFF";
                }
            }

            if ('state_l2' in mqttMessage && device.stateField == "state_l2"){
                //console.log(`${deviceId} STATE RIGHT: ${mqttMessage.state_right}`);
                if (mqttMessage.state_l2 == "ON"){
                    device.payload = "ON";
                }else{
                    device.payload = "OFF";
                }
            }

        }else if ('state_left' in mqttMessage && 'state_right' in mqttMessage){

            //console.log(`${deviceId} has STATE LEFT OR RIGHT`);

            if ('state_left' in mqttMessage && device.stateField == "state_left"){
                //console.log(`${deviceId} STATE LEFT: ${mqttMessage.state_left}`);
                if (mqttMessage.state_left == "ON"){
                    device.payload = "ON";
                }else{
                    device.payload = "OFF";
                }
            }

            if ('state_right' in mqttMessage && device.stateField == "state_right"){
                //console.log(`${deviceId} STATE RIGHT: ${mqttMessage.state_right}`);
                if (mqttMessage.state_right == "ON"){
                    device.payload = "ON";
                }else{
                    device.payload = "OFF";
                }
            }

        }else{
            console.log(`${deviceId} STATE: ${mqttMessage.state}`);
   
            if ('state' in mqttMessage){
                if (mqttMessage.state == "ON"){
                    device.payload = "ON";
                }else{
                    device.payload = "OFF";
                }
            }
        }
    }

    if (deviceDomain == "wled"){
      // This device is a WLED
      // To identify if the device is on we refer ourself to the current preset
      if (mqttMessage !== "PL=10"){
        device.payload = "ON";
      }else{
        device.payload = "OFF";
      }
    }

    if (device) {
      const { deviceId, imageUrl, payload, name } = device;
      const state = message.toString();

      io.emit('atualizarImagem', { deviceId, imageUrl, payload, name });
      io.emit('mensagemRecebida', { deviceId, state, name });
    }
  });

  // Route to serve the JSON file containing the devices' information
  app.get('/devices', (req, res) => {
    const devicesArray = Array.from(devices.values());
    res.json(devicesArray);
  });

  // Route to serve the HTML page
  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
  });

  // Start the HTTP server
  http.listen(80, () => {
    console.log('Node.js server running on port 80');
  });
}
