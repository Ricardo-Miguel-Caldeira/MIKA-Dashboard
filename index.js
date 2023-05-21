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


// Configuração da conexão com o banco de dados MySQL
const db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
}); 

// Criação da coleção de dispositivos
const devices = new Map();

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados MySQL:', err);
    return;
  }

  console.log('Conexão com o banco de dados MySQL estabelecida');

  // Carrega todos os dispositivos da base de dados numa colecção
  //    Cada vez que um dispositivo 
  db.query('SELECT tele_topic, name, state_field, imageUrl FROM devices WHERE enable = 1 AND tele_topic IS NOT NULL', (err, rows) => {
    if (err) {
      console.error('Erro ao buscar dispositivos no banco de dados MySQL:', err);
      return;
    }  

    rows.forEach((row) => {
        const device = {
          deviceId: row.tele_topic,
          deviceName: row.name,
          stateField: row.state_field,
          imageUrl: row.imageUrl,
          payload: "OFF"
        };
      
        // Verifica a existência da imagem
        checkImageExists(row.imageUrl, (exists) => {
          if (exists) {
            devices.set(row.name, device);
          } else {
            console.warn(`A imagem "${row.imageUrl}" não existe. Usando imagem alternativa.`);
            device.imageUrl = '1920x1080/render.png'; // Especifique o caminho para a imagem alternativa
            devices.set(row.name, device); 
          }
        });
      });

    });
 
    // Iniciar o servidor MQTT após carregar os dispositivos
    startMqttServer();
  });


  function checkImageExists(imagePath, callback) {
    fs.access(imagePath, fs.constants.F_OK, (err) => {
      if (!err) {
        callback(true); // A imagem existe
      } else {
        console.warn(`A imagem "${imagePath}" não existe. Usando imagem alternativa.`);
        callback(false); // A imagem não existe
      }
    });
  }

function startMqttServer() {
  // Configuração do servidor MQTT
  const mqttClient = mqtt.connect('mqtt://10.1.10.17', {
    username: 'rcaldeira',
    password: 'XTAZII123'
  });

  mqttClient.on('connect', () => {

    // Inscreva-se nos tópicos de cada dispositivo
    //devices.forEach((device, topic) => {
    //  mqttClient.subscribe(topic);
    //});

    mqttClient.subscribe('zigbee2mqtt/tasmota/+/tele/STATE');
    mqttClient.subscribe('zigbee2mqtt/lled/+');
    mqttClient.subscribe('zigbee2mqtt/switch/+');


  });

  mqttClient.on('message', (topic, message) => {
    // Encontre o dispositivo correspondente ao tópico e envie as informações através do websocket
    // console.log(`Mensagem recebida do device: ${topic.split('/')[2]} : ${message.toString()}`);

    deviceDomain = topic.split('/')[1]
    deviceId = topic.split('/')[2]

    const device = devices.get(topic.split('/')[2]);
    if (!device) return false

    const mqttMessage = JSON.parse(message);
    
    //console.log(device.stateField)
    
    //  Para cada dominio temos uma forma especifica de identificar se o device está ON ou não
    if (deviceDomain == "tasmota"){
        //console.log(mqttMessage);
        if ('POWER' in mqttMessage){
            if (mqttMessage.POWER == "ON"){
                device.payload = "ON";
            }else{
                device.payload = "OFF";
            }
        }
    }

    if (deviceDomain == "lled"){
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
        
        // device may have state_left and state_right
        if ('state_l1' in mqttMessage && 'state_l2' in mqttMessage){
            
            console.log(`${deviceId} has STATE L1 OR L2`);

            if ('state_l1' in mqttMessage && device.stateField == "state_l1"){
                console.log(`${deviceId} STATE LEFT: ${mqttMessage.state_left}`);
                if (mqttMessage.state_l1 == "ON"){
                    device.payload = "ON";
                }else{
                    device.payload = "OFF";
                }
            }

            if ('state_l2' in mqttMessage && device.stateField == "state_l2"){
                console.log(`${deviceId} STATE RIGHT: ${mqttMessage.state_right}`);
                if (mqttMessage.state_l2 == "ON"){
                    device.payload = "ON";
                }else{
                    device.payload = "OFF";
                }
            }

        }else if ('state_left' in mqttMessage && 'state_right' in mqttMessage){

            console.log(`${deviceId} has STATE LEFT OR RIGHT`);

            if ('state_left' in mqttMessage && device.stateField == "state_left"){
                console.log(`${deviceId} STATE LEFT: ${mqttMessage.state_left}`);
                if (mqttMessage.state_left == "ON"){
                    device.payload = "ON";
                }else{
                    device.payload = "OFF";
                }
            }

            if ('state_right' in mqttMessage && device.stateField == "state_right"){
                console.log(`${deviceId} STATE RIGHT: ${mqttMessage.state_right}`);
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

    if (device) {
      const { deviceId, imageUrl, payload } = device;
      const state = message.toString();

      io.emit('atualizarImagem', { deviceId, imageUrl, payload });
    }
  });

  // Rota para servir o arquivo JSON contendo as informações dos dispositivos
  app.get('/devices', (req, res) => {
    const devicesArray = Array.from(devices.values());
    res.json(devicesArray);
  });

  // Rota para servir a página HTML
  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
  });

  // Iniciar o servidor HTTP
  http.listen(3000, () => {
    console.log('Servidor Node.js executando na porta 3000');
  });
}
