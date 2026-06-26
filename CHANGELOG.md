# Changelog

## Unreleased

### Changed

- Made frontend voice activity tracking independent from `onnxruntime-web`, avoiding the Vite dynamic import warning caused by the unused dependency.
- Kept browser speech recognition optional: Chrome/Chromium can still transcribe speech and detect prohibited words, while Firefox continues to detect voice activity through Web Audio.
- Added diagnostic logs for unsupported speech recognition, detected voice activity without transcripts, recognized transcripts, and audio violations.

