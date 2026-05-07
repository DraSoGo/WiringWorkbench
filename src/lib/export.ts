// Export engine — input: DiagramState, output: JSON or Arduino stub
// Implementation in Phase 4

export function exportJson(): string {
  return '{}';
}

export function exportArduinoStub(): string {
  return '// pin assignments\nvoid setup() {}\nvoid loop() {}';
}
