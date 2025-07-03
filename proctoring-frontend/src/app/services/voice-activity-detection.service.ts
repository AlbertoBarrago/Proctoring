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
  private readonly SPEECH_THRESHOLD = 0.5;

  // Hidden states for the RNN model
  private h: Float32Array = new Float32Array(128);
  private c: Float32Array = new Float32Array(128);

  private vadResultSubject = new BehaviorSubject<VADResult | null>(null);
  public vadResult$ = this.vadResultSubject.asObservable();

  constructor() {
    this.configureONNXRuntime();
  }

  private configureONNXRuntime(): void {
    // Configure ONNX Runtime Web paths
    env.wasm.wasmPaths = {
      //@ts-ignore
      'ort-wasm-simd-threaded.wasm': '/assets/ort-wasm-simd-threaded.wasm',
      'ort-wasm-simd-threaded.jsep.wasm': '/assets/ort-wasm-simd-threaded.jsep.wasm'
    };

    // Set execution providers (try CPU only for now)
    env.wasm.numThreads = 1;
    env.wasm.simd = true;
    env.wasm.proxy = false;

    console.log('ONNX Runtime Web configured');
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

      // Try to load the VAD model (optional)
      try {
        await this.loadVADModel();
        this.vadModelAvailable = true;
        console.log('VAD model loaded successfully');
      } catch (error) {
        console.warn('VAD model not available, using basic audio detection:', error);
        this.vadModelAvailable = false;
      }

      this.isInitialized = true;
      console.log('Voice Activity Detection service initialized successfully');
    } catch (error) {
      console.error('Error initializing VAD service:', error);
      throw error;
    }
  }

  private async loadVADModel(): Promise<void> {
    try {
      // Skip model loading for now - we'll use basic energy detection
      console.log('Skipping VAD model loading - using basic energy detection');
      return;

      // Uncomment this when you have the actual model file
      // this.onnxSession = await InferenceSession.create('/assets/models/silero_vad.onnx');
      // console.log('Silero VAD model loaded successfully');
    } catch (error) {
      console.error('Error loading VAD model:', error);
      throw new Error('Failed to load VAD model');
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
          autoGainControl: false
        }
      });

      if (!this.audioContext) {
        throw new Error('Audio context not available');
      }

      console.log('Media stream sample rate:', this.audioContext.sampleRate);

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

      // Listen for audio data from worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        this.processAudioData(event.data);
      };

      this.isMonitoring = true;
      console.log('Voice activity monitoring started');
    } catch (error) {
      console.error('Error starting VAD monitoring:', error);
      throw error;
    }
  }

  private async processAudioData(audioData: Float32Array): Promise<void> {
    if (audioData.length !== this.WINDOW_SIZE_SAMPLES) {
      return;
    }

    try {
      let isSpeech = false;
      let confidence = 0;

      if (this.vadModelAvailable && this.onnxSession) {
        // Use Silero VAD model
        const result = await this.runSileroVAD(audioData);
        isSpeech = result.isSpeech;
        confidence = result.confidence;
      } else {
        // Use basic energy-based detection as fallback
        const energy = this.calculateAudioEnergy(audioData);
        confidence = Math.min(energy / 0.01, 1.0); // Normalize to 0-1
        isSpeech = energy > 0.001; // Simple threshold
      }

      // Emit VAD result
      const vadResult: VADResult = {
        isSpeech,
        confidence,
        timestamp: Date.now()
      };

      this.vadResultSubject.next(vadResult);

    } catch (error) {
      console.error('Error processing audio data:', error);
    }
  }

  private async runSileroVAD(audioData: Float32Array): Promise<{isSpeech: boolean, confidence: number}> {
    if (!this.onnxSession) {
      throw new Error('ONNX session not available');
    }

    // Prepare input tensors for Silero VAD
    const inputTensor = new Tensor('float32', audioData, [1, audioData.length]);
    const srTensor = new Tensor('int64', [this.TARGET_SAMPLE_RATE], [1]);
    const hTensor = new Tensor('float32', this.h, [1, 1, 128]);
    const cTensor = new Tensor('float32', this.c, [1, 1, 128]);

    // Run inference
    const feeds = {
      'input': inputTensor,
      'sr': srTensor,
      'h': hTensor,
      'c': cTensor
    };

    const results = await this.onnxSession.run(feeds);

    // Extract results
    const speechProb = results['output'].data[0] as number;
    const newH = results['hn'].data as Float32Array;
    const newC = results['cn'].data as Float32Array;

    // Update hidden states
    this.h.set(newH);
    this.c.set(newC);

    return {
      isSpeech: speechProb > this.SPEECH_THRESHOLD,
      confidence: speechProb
    };
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
