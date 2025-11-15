#pragma once

#ifdef ENABLE_MATRIX_PANEL

namespace display
{
  void initMatrixPanel();
  void tickMatrixPanel(unsigned long now);
  bool isMatrixReady();
} // namespace display

#endif // ENABLE_MATRIX_PANEL