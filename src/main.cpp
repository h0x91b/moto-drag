#include <Arduino.h>

const int LED_PIN = 8; // Для ESP32-C3 DevKitM-1 встроенный светодиод — GPIO8

void setup()
{
  pinMode(LED_PIN, OUTPUT);
  // Инициализируем CDC-Serial
  Serial.begin(115200);
  // Даём времени хосту открыть порт (особенно на macOS)
  while (!Serial && millis() < 3000)
  {
    delay(10);
  }
  delay(200); // крошечная подстраховка
  Serial.println("\n[BOOT] Hello from ESP32-C3 over USB-CDC");
}

void loop()
{
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(300);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(300);
}