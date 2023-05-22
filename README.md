# MIKA-Dashboard

MIKA dashboard is intended to be a NodeJS MQTT Dashboard.

MIKA subscribes MQTT topics from one authenticated MQTT server and when a message is delivered it shows the corresponding blended 3d images for each device that is ON/OFF.
Each device is one PNG image (State ON) and is served in the front end to all clients connected.

MIKA also receives initial device information from one MySQL database, at startup only and uses websockets to refresh the devices enable in the client browsers.

To diferentiate each kind of device MIKA uses predefined Domains like SWITCH, WLED, LLED, TASMOTA. This domain is also embebed in the MQTT Topic to identification purposes and filtering.

mqttbaseTopic/deviceDomain/deviceName/...

Known issues:

MQTT topics to subscribe is still not impelemnented. Currently only all topics per domain is available.
There is no login/credentials required as this is intended to work locally.
Some browsers are not outputing the images. Reason unkown. It works fine Chrome. The original concept was to use this project in smart tv browsers.

Please be advised that this project is still under development and in early stage of development.

Example of images used:

![render0011](https://github.com/Ricardo-Miguel-Caldeira/MIKA-Dashboard/assets/52119136/5853f54b-5ff7-4278-a3b1-e5c45e20aa17)
![render0024](https://github.com/Ricardo-Miguel-Caldeira/MIKA-Dashboard/assets/52119136/9dec6988-a6f7-4692-804b-b8ca6eb0dd0c)


