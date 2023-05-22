# MIKA-Dashboard

MIKA dashboard is intended to be a NodeJS MQTT Dashboard.

MIKA subscribes MQTT messages from one authenticated server and when message is delivered shows corresponding blended 3d images if the device is ON/OFF.
Each device correspondes to one PNG image that is served in the front end.

MIKA also receives initial device information from one MySQL database, at startup only and uses websockets to refresh the devices enable in the client browsers.

Example of images used:

![render0011](https://github.com/Ricardo-Miguel-Caldeira/MIKA-Dashboard/assets/52119136/5853f54b-5ff7-4278-a3b1-e5c45e20aa17)
![render0024](https://github.com/Ricardo-Miguel-Caldeira/MIKA-Dashboard/assets/52119136/9dec6988-a6f7-4692-804b-b8ca6eb0dd0c)


