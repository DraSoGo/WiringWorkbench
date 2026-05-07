import type { ComponentDef } from '../store/diagram';

export const SENSORS: ComponentDef[] = [
  {
    id: 'dht11',
    name: 'DHT11',
    type: 'sensor',
    category: 'Environment',
    notes: 'Temperature & humidity sensor. Single-wire protocol. 3.3–5V.',
    ports: [
      { id: 'VCC',  label: 'VCC',  role: 'power' },
      { id: 'GND',  label: 'GND',  role: 'gnd' },
      { id: 'DATA', label: 'DATA', role: 'digital' },
    ],
  },

  {
    id: 'hc-sr04',
    name: 'HC-SR04',
    type: 'sensor',
    category: 'Distance',
    notes: 'Ultrasonic distance sensor. 2cm–400cm range. 5V only.',
    ports: [
      { id: 'VCC',  label: 'VCC',   role: 'power' },
      { id: 'GND',  label: 'GND',   role: 'gnd' },
      { id: 'TRIG', label: 'TRIG',  role: 'digital' },
      { id: 'ECHO', label: 'ECHO',  role: 'digital' },
    ],
  },

  {
    id: 'mpu6050',
    name: 'MPU6050',
    type: 'sensor',
    category: 'Motion',
    notes: '6-axis IMU: 3-axis gyro + 3-axis accelerometer. I2C, addr 0x68/0x69.',
    ports: [
      { id: 'VCC',  label: 'VCC',          role: 'power' },
      { id: 'GND',  label: 'GND',          role: 'gnd' },
      { id: 'SDA',  label: 'SDA',          role: 'i2c' },
      { id: 'SCL',  label: 'SCL',          role: 'i2c' },
      { id: 'INT',  label: 'INT',          role: 'digital' },
      { id: 'AD0',  label: 'AD0 (addr)',   role: 'digital' },
      { id: 'XCL',  label: 'XCL (aux SCL)', role: 'i2c' },
      { id: 'XDA',  label: 'XDA (aux SDA)', role: 'i2c' },
    ],
  },

  {
    id: 'ssd1306',
    name: 'SSD1306 OLED',
    type: 'sensor',
    category: 'Display',
    notes: '128×64 monochrome OLED. I2C addr 0x3C or 0x3D. 3.3–5V.',
    ports: [
      { id: 'VCC', label: 'VCC', role: 'power' },
      { id: 'GND', label: 'GND', role: 'gnd' },
      { id: 'SDA', label: 'SDA', role: 'i2c' },
      { id: 'SCL', label: 'SCL', role: 'i2c' },
    ],
  },

  {
    id: 'relay-module',
    name: 'Relay Module',
    type: 'sensor',
    category: 'Actuator',
    notes: '5V single-channel relay. IN pin is active-LOW. Switches AC/DC loads.',
    ports: [
      { id: 'VCC', label: 'VCC',         role: 'power' },
      { id: 'GND', label: 'GND',         role: 'gnd' },
      { id: 'IN',  label: 'IN (signal)', role: 'digital' },
      { id: 'NO',  label: 'NO (load)',   role: 'custom' },
      { id: 'COM', label: 'COM (load)',  role: 'custom' },
      { id: 'NC',  label: 'NC (load)',   role: 'custom' },
    ],
  },

  {
    id: 'ir-receiver',
    name: 'IR Receiver',
    type: 'sensor',
    category: 'Communication',
    notes: 'VS1838B / TSOP38238. Receives 38kHz IR signals. Use IRremote lib.',
    ports: [
      { id: 'VCC',  label: 'VCC',  role: 'power' },
      { id: 'GND',  label: 'GND',  role: 'gnd' },
      { id: 'DATA', label: 'DATA', role: 'digital' },
    ],
  },

  {
    id: 'servo',
    name: 'Servo Motor',
    type: 'sensor',
    category: 'Actuator',
    notes: 'Standard 3-wire hobby servo (SG90 etc). PWM signal, 50Hz. 5V.',
    ports: [
      { id: 'VCC',   label: 'VCC (red)',    role: 'power' },
      { id: 'GND',   label: 'GND (brown)',  role: 'gnd' },
      { id: 'SIGNAL', label: 'SIG (yellow)', role: 'pwm' },
    ],
  },

  {
    id: 'neopixel',
    name: 'NeoPixel Strip',
    type: 'sensor',
    category: 'Actuator',
    notes: 'WS2812B addressable RGB LED strip. 5V. Use Adafruit NeoPixel lib.',
    ports: [
      { id: 'VCC',  label: '5V',   role: 'power' },
      { id: 'GND',  label: 'GND',  role: 'gnd' },
      { id: 'DIN',  label: 'DIN',  role: 'digital' },
      { id: 'DOUT', label: 'DOUT', role: 'digital' },
    ],
  },

  {
    id: 'soil-moisture',
    name: 'Soil Moisture Sensor',
    type: 'sensor',
    category: 'Environment',
    notes: 'Capacitive or resistive probe. Analog output: high = dry, low = wet.',
    ports: [
      { id: 'VCC',  label: 'VCC',       role: 'power' },
      { id: 'GND',  label: 'GND',       role: 'gnd' },
      { id: 'AOUT', label: 'AOUT (analog)', role: 'analog' },
      { id: 'DOUT', label: 'DOUT (digital threshold)', role: 'digital' },
    ],
  },

  {
    id: 'mq2',
    name: 'MQ-2 Gas Sensor',
    type: 'sensor',
    category: 'Environment',
    notes: 'Detects LPG, smoke, alcohol, propane, hydrogen, methane. Warmup ~20s.',
    ports: [
      { id: 'VCC',  label: 'VCC',       role: 'power' },
      { id: 'GND',  label: 'GND',       role: 'gnd' },
      { id: 'AOUT', label: 'AOUT (analog)', role: 'analog' },
      { id: 'DOUT', label: 'DOUT (threshold)', role: 'digital' },
    ],
  },
];
