#include "display/MatrixPanel.h"

#include <Arduino.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>

namespace display
{
namespace
{
constexpr uint16_t kPanelResX = 32;
constexpr uint16_t kPanelResY = 64;
constexpr uint8_t kNumRows = 1;
constexpr uint8_t kNumCols = 1;

// HUB75 pin map tailored for the current wiring harness
constexpr int8_t kR1 = 7;
constexpr int8_t kG1 = 5;
constexpr int8_t kB1 = 6;
constexpr int8_t kR2 = 12;
constexpr int8_t kG2 = 13;
constexpr int8_t kB2 = 14;
constexpr int8_t kA = 4;
constexpr int8_t kB = 3;
constexpr int8_t kC = 2;
constexpr int8_t kD = 1;
constexpr int8_t kE = -1;
constexpr int8_t kLat = 21;
constexpr int8_t kOe = 15;
constexpr int8_t kClk = 20;

MatrixPanel_I2S_DMA *matrixPanel = nullptr;
bool matrixReady = false;
constexpr unsigned long kMessageIntervalMs = 1000;
unsigned long lastMessageAt = 0;
bool invertState = false;

void drawGreeting(bool inverted)
{
  if (!matrixReady || !matrixPanel)
  {
    return;
  }

  uint16_t background = inverted ? matrixPanel->color565(12, 0, 48) : matrixPanel->color565(0, 0, 0);
  uint16_t accent = inverted ? matrixPanel->color565(255, 200, 16) : matrixPanel->color565(0, 220, 160);
  uint16_t text = matrixPanel->color565(255, 255, 255);
  uint16_t frame = matrixPanel->color565(32, 32, 32);

  matrixPanel->fillScreen(background);
  matrixPanel->drawRect(0, 0, matrixPanel->width(), matrixPanel->height(), frame);

  matrixPanel->setCursor(4, 6);
  matrixPanel->setTextColor(accent);
  matrixPanel->print("moto-drag");

  matrixPanel->setCursor(10, 18);
  matrixPanel->setTextColor(text);
  matrixPanel->print("HELLO!");
}
} // namespace

void initMatrixPanel()
{
  if (matrixPanel)
  {
    return;
  }

  HUB75_I2S_CFG::i2s_pins pins = {
      kR1, kG1, kB1,
      kR2, kG2, kB2,
      kA, kB, kC, kD, kE,
      kLat, kOe, kClk};

  HUB75_I2S_CFG mxconfig(
      kPanelResX * 2, // Panel driver expects doubled width
      kPanelResY / 2,
      kNumRows * kNumCols,
      pins);

  mxconfig.double_buff = false;
  mxconfig.clkphase = true;

  matrixPanel = new MatrixPanel_I2S_DMA(mxconfig);
  if (!matrixPanel)
  {
    Serial.println("[LED] matrix allocation failed");
    return;
  }
  if (!matrixPanel->begin())
  {
    Serial.println("[LED] matrix begin() failed");
    delete matrixPanel;
    matrixPanel = nullptr;
    return;
  }

  matrixPanel->setBrightness8(96);
  matrixPanel->setTextWrap(false);
  matrixPanel->setTextSize(1);
  matrixPanel->clearScreen();

  matrixReady = true;
  drawGreeting(false);
  Serial.println("[LED] HUB75 DMA matrix ready");
}

void tickMatrixPanel(unsigned long now)
{
  if (!matrixReady || !matrixPanel)
  {
    return;
  }
  if (now - lastMessageAt < kMessageIntervalMs)
  {
    return;
  }

  invertState = !invertState;
  lastMessageAt = now;
  drawGreeting(invertState);
}

bool isMatrixReady()
{
  return matrixReady;
}
} // namespace display
