import { Injectable } from '@angular/core';
import { InferenceSession, Tensor, env } from 'onnxruntime-web';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

interface VADResult {
  isSpeech: boolean;
  confidence: number;
  timestamp: number;
}

interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  timestamp: number;
}

interface ViolationResult {
  detectedWord: string;
  transcript: string;
  confidence: number;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}

@Injectable({
  providedIn: 'root'
})
export class VoiceDetectionService {
  private onnxSession: InferenceSession | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private isInitialized = false;
  private isMonitoring = false;

  // Speech Recognition
  private recognition: any = null;
  private isListening = false;

  // Prohibited words configuration
  private prohibitedWords: Set<string> = new Set([
    'help', 'assistant', 'google', 'search', 'answer', 'cheat', 'copy', 'paste',
    'phone', 'call', 'text', 'message', 'ask', 'tell', 'whisper'
  ]);

  // Silero VAD configuration
  private readonly TARGET_SAMPLE_RATE = 16000;
  private readonly WINDOW_SIZE_SAMPLES = 512;
  private readonly SPEECH_THRESHOLD = 0.001;

  // Hidden states for the RNN model
  private h: Float32Array = new Float32Array(128);
  private c: Float32Array = new Float32Array(128);

  // Observables
  private vadResultSubject = new BehaviorSubject<VADResult | null>(null);
  public vadResult$ = this.vadResultSubject.asObservable();

  private speechRecognitionSubject = new Subject<SpeechRecognitionResult>();
  public speechRecognition$ = this.speechRecognitionSubject.asObservable();

  private violationSubject = new Subject<ViolationResult>();
  public violation$ = this.violationSubject.asObservable();

  // Debug variables
  private debugCounter = 0;
  private maxRMS = 0;
  private minRMS = Infinity;

  constructor() {
    this.configureONNXRuntime();
    this.initializeSpeechRecognition();
  }


  private configureONNXRuntime(): void {
    env.wasm.wasmPaths = {
      //@ts-ignore
      'ort-wasm-simd-threaded.wasm': '/assets/ort-wasm-simd-threaded.wasm',
      'ort-wasm-simd-threaded.jsep.wasm': '/assets/ort-wasm-simd-threaded.jsep.wasm'
    };

    env.wasm.numThreads = 1;
    env.wasm.simd = true;
    env.wasm.proxy = false;

    console.log('ONNX Runtime Web configured with available WASM files');
  }

  private initializeSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 3;

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.toLowerCase().trim();
        const confidence = result[0].confidence || 0.5;

        if (confidence > 0.3) { // Lower threshold for more sensitivity
          this.checkForViolations(transcript, confidence);
        }

        console.log(`Speech result: "${transcript}" (final: ${result.isFinal}, confidence: ${confidence})`);

        if (result.isFinal) {
          const speechResult: SpeechRecognitionResult = {
            transcript,
            confidence,
            timestamp: Date.now()
          };

          this.speechRecognitionSubject.next(speechResult);
        }
      }
    };

    this.recognition.onstart = () => {
      console.log('Speech recognition started successfully');
    };


    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      // Restart recognition if it stops due to error
      if (this.isListening) {
        setTimeout(() => {
          this.startSpeechRecognition();
        }, 1000);
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');

      // Restart recognition if we're still monitoring
      if (this.isListening && this.isMonitoring) {
        setTimeout(() => {
          this.startSpeechRecognition();
        }, 500);
      }
    };
  }

  private checkForViolations(transcript: string, confidence: number): void {
    const words = transcript.split(/\s+/);
    console.log(`Checking violations for: "${transcript}"`);
    console.log(`Current prohibited words:`, Array.from(this.prohibitedWords));


    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '');

      if (this.prohibitedWords.has(cleanWord)) {
        const violation: ViolationResult = {
          detectedWord: cleanWord,
          transcript,
          confidence,
          timestamp: Date.now(),
          severity: this.getSeverityLevel(cleanWord)
        };

        this.violationSubject.next(violation);
        console.warn(`🚨 Prohibited word detected: "${cleanWord}" in transcript: "${transcript}"`);
      }
    }
  }

  private getSeverityLevel(word: string): 'low' | 'medium' | 'high' {
    const highSeverityWords = ['help', 'assistant', 'cheat', 'answer'];
    const mediumSeverityWords = ['google', 'search', 'ask', 'tell'];

    if (highSeverityWords.includes(word)) return 'high';
    if (mediumSeverityWords.includes(word)) return 'medium';
    return 'low';
  }

  private startSpeechRecognition(): void {
    if (!this.recognition || this.isListening) return;

    try {
      this.recognition.start();
      this.isListening = true;
      console.log('Speech recognition started');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }

  private stopSpeechRecognition(): void {
    if (!this.recognition || !this.isListening) return;

    try {
      this.recognition.stop();
      this.isListening = false;
      console.log('Speech recognition stopped');
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing VAD service...');

      // Create AudioContext
      this.audioContext = new AudioContext();
      console.log('AudioContext created with sample rate:', this.audioContext.sampleRate);

      // Load audio worklet for real-time processing
      await this.loadAudioWorklet();

      console.log('Using basic energy detection for voice activity');

      this.isInitialized = true;
      console.log('Voice Activity Detection service initialized successfully');
    } catch (error) {
      console.error('Error initializing VAD service:', error);
      throw error;
    }
  }

  private async loadAudioWorklet(): Promise<void> {
    try {
      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }

      await this.audioContext.audioWorklet.addModule('/assets/js/vad.js');
      console.log('Audio worklet loaded successfully');
    } catch (error) {
      console.error('Error loading audio worklet:', error);
      throw error;
    }
  }

  async startMonitoring(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('VAD service not initialized');
    }

    if (this.isMonitoring) {
      return;
    }

    try {

      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 48000
        }
      });

      if (!this.audioContext) {
        throw new Error('Audio context not available');
      }

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('AudioContext resumed');
      }

      // Create audio nodes
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'vad-processor', {
        processorOptions: {
          targetSampleRate: this.TARGET_SAMPLE_RATE,
          sourceSampleRate: this.audioContext.sampleRate
        }
      });

      // Connect audio nodes
      source.connect(this.audioWorkletNode);

      // Listen for audio data from the worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        this.processAudioData(event.data);
      };

      // Start speech recognition
      this.startSpeechRecognition();

      // Reset debug counters
      this.debugCounter = 0;
      this.maxRMS = 0;
      this.minRMS = Infinity;

      this.isMonitoring = true;
      console.log('Voice activity monitoring and speech recognition started');
    } catch (error) {
      console.error('Error starting VAD monitoring:', error);
      throw error;
    }
  }

  private async processAudioData(audioData: Float32Array): Promise<void> {
    this.debugCounter++;

    if (audioData.length !== this.WINDOW_SIZE_SAMPLES) {
      if (this.debugCounter % 100 === 0) {
        console.log(`Unexpected buffer size: ${audioData.length}, expected: ${this.WINDOW_SIZE_SAMPLES}`);
      }
      return;
    }

    try {
      // Calculate audio energy and RMS
      const energy = this.calculateAudioEnergy(audioData);
      const rms = Math.sqrt(energy);

      // Update debug stats
      this.maxRMS = Math.max(this.maxRMS, rms);
      this.minRMS = Math.min(this.minRMS, rms);

      // Adaptive threshold based on observed levels
      let speechThreshold = this.SPEECH_THRESHOLD;
      if (this.maxRMS > 0) {
        speechThreshold = this.maxRMS * 0.1;
      }

      const confidence = Math.min(rms / speechThreshold, 1.0);
      const isSpeech = rms > speechThreshold;

      // Emit VAD result
      const vadResult: VADResult = {
        isSpeech,
        confidence,
        timestamp: Date.now()
      };

      this.vadResultSubject.next(vadResult);

      if (this.debugCounter % 50 === 0) {
        console.log(`VAD Stats: Speech=${isSpeech}, RMS=${rms.toFixed(6)}, Threshold=${speechThreshold.toFixed(6)}, Min=${this.minRMS.toFixed(6)}, Max=${this.maxRMS.toFixed(6)}, Buffers processed=${this.debugCounter}`);
      }

    } catch (error) {
      console.error('Error processing audio data:', error);
    }
  }

  private calculateAudioEnergy(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return sum / audioData.length;
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    try {
      // Stop speech recognition
      this.stopSpeechRecognition();

      // Stop audio worklet
      if (this.audioWorkletNode) {
        this.audioWorkletNode.disconnect();
        this.audioWorkletNode = null;
      }

      // Stop media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      // Reset hidden states
      this.h.fill(0);
      this.c.fill(0);

      this.isMonitoring = false;
      console.log('Voice activity monitoring and speech recognition stopped');
    } catch (error) {
      console.error('Error stopping VAD monitoring:', error);
    }
  }

  // Public methods for managing prohibited words
  addProhibitedWord(word: string): void {
    this.prohibitedWords.add(word.toLowerCase());
  }

  removeProhibitedWord(word: string): void {
    this.prohibitedWords.delete(word.toLowerCase());
  }

  setProhibitedWords(words: string[]): void {
    this.prohibitedWords = new Set(words.map(word => word.toLowerCase()));
  }

  getProhibitedWords(): string[] {
    return Array.from(this.prohibitedWords);
  }

  // Observable getters
  getVADResult(): Observable<VADResult | null> {
    return this.vadResult$;
  }

  getSpeechRecognition(): Observable<SpeechRecognitionResult> {
    return this.speechRecognition$;
  }

  getViolations(): Observable<ViolationResult> {
    return this.violation$;
  }

  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  cleanup(): void {
    this.stopMonitoring();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.onnxSession) {
      this.onnxSession = null;
    }

    this.isInitialized = false;
  }
}
