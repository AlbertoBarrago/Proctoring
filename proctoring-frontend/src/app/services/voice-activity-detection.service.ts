import { Injectable } from '@angular/core';
import { InferenceSession, Tensor, env } from 'onnxruntime-web';
import { BehaviorSubject, Observable } from 'rxjs';

interface VADResult {
  isSpeech: boolean;
  confidence: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceActivityDetectionService {
  private onnxSession: InferenceSession | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private isInitialized = false;
  private isMonitoring = false;
  private vadModelAvailable = false;

  // Silero VAD configuration
  private readonly TARGET_SAMPLE_RATE = 16000;
  private readonly WINDOW_SIZE_SAMPLES = 512; // 32ms window at 16kHz
  private readonly SPEECH_THRESHOLD = 0.001; // Soglia molto più bassa per debug

  // Hidden states for the RNN model
  private h: Float32Array = new Float32Array(128);
  private c: Float32Array = new Float32Array(128);

  private vadResultSubject = new BehaviorSubject<VADResult | null>(null);
  public vadResult$ = this.vadResultSubject.asObservable();

  // Debug variables
  private debugCounter = 0;
  private maxRMS = 0;
  private minRMS = Infinity;

  constructor() {
    this.configureONNXRuntime();
  }

  private configureONNXRuntime(): void {
    // Configure ONNX Runtime Web paths - solo i file che esistono effettivamente
    env.wasm.wasmPaths = {
      //@ts-ignore
      'ort-wasm-simd-threaded.wasm': '/assets/ort-wasm-simd-threaded.wasm',
      'ort-wasm-simd-threaded.jsep.wasm': '/assets/ort-wasm-simd-threaded.jsep.wasm'
    };

    // Set execution providers - usa CPU backend per sicurezza
    env.wasm.numThreads = 1;
    env.wasm.simd = true;
    env.wasm.proxy = false;

    console.log('ONNX Runtime Web configured with available WASM files');
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

      // Skip VAD model loading for now - use basic energy detection
      console.log('Using basic energy detection for voice activity');
      this.vadModelAvailable = false;

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
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000 // Prova a specificare un sample rate
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

      console.log('Media stream sample rate:', this.audioContext.sampleRate);
      console.log('AudioContext state:', this.audioContext.state);

      // Create audio nodes
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      console.log('MediaStreamSource created');

      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'vad-processor', {
        processorOptions: {
          targetSampleRate: this.TARGET_SAMPLE_RATE,
          sourceSampleRate: this.audioContext.sampleRate
        }
      });

      console.log('AudioWorkletNode created');

      // Connect audio nodes
      source.connect(this.audioWorkletNode);
      console.log('Audio nodes connected');

      // Listen for audio data from worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        this.processAudioData(event.data);
      };

      // Reset debug counters
      this.debugCounter = 0;
      this.maxRMS = 0;
      this.minRMS = Infinity;

      this.isMonitoring = true;
      console.log('Voice activity monitoring started');
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
        speechThreshold = this.maxRMS * 0.1; // 10% of max observed RMS
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

      // Debug logging ogni 50 risultati (circa ogni secondo)
      if (this.debugCounter % 50 === 0) {
        console.log(`VAD Stats: Speech=${isSpeech}, RMS=${rms.toFixed(6)}, Threshold=${speechThreshold.toFixed(6)}, Min=${this.minRMS.toFixed(6)}, Max=${this.maxRMS.toFixed(6)}, Buffers processed=${this.debugCounter}`);
      }

      // Log di attività vocale quando rilevata
      if (isSpeech) {
        console.log(`🗣️ Speech detected! RMS=${rms.toFixed(6)}, Confidence=${confidence.toFixed(2)}`);
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
      console.log('Voice activity monitoring stopped');
      console.log(`Final stats: Min RMS=${this.minRMS.toFixed(6)}, Max RMS=${this.maxRMS.toFixed(6)}, Total buffers=${this.debugCounter}`);
    } catch (error) {
      console.error('Error stopping VAD monitoring:', error);
    }
  }

  getVADResult(): Observable<VADResult | null> {
    return this.vadResult$;
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
