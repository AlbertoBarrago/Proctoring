export interface VADResult {
  isSpeech: boolean;
  confidence: number;
  timestamp: number;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  timestamp: number;
}

export interface ViolationResult {
  detectedWord: string;
  transcript: string;
  confidence: number;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}
