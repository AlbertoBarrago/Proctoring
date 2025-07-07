class VADProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // Get configuration from options
    this.targetSampleRate = options.processorOptions?.targetSampleRate || 16000;
    this.sourceSampleRate = options.processorOptions?.sourceSampleRate || 44100;

    this.bufferSize = 512; // Target buffer size for VAD (32ms at 16kHz)
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;

    // Resampling variables
    this.resampleRatio = this.sourceSampleRate / this.targetSampleRate;

    // Debug variables
    this.processCallCount = 0;
    this.buffersSent = 0;

    console.log(`VAD Processor initialized: ${this.sourceSampleRate}Hz -> ${this.targetSampleRate}Hz (ratio: ${this.resampleRatio.toFixed(2)})`);
  }

  process(inputs, outputs, parameters) {
    this.processCallCount++;

    const input = inputs[0];

    if (input && input.length > 0 && input[0]) {
      const inputChannel = input[0];

      // Debug logging ogni 1000 chiamate
      if (this.processCallCount % 1000 === 0) {
        console.log(`AudioWorklet: Processed ${this.processCallCount} calls, sent ${this.buffersSent} buffers, input size: ${inputChannel.length}`);
      }

      // Process audio for VAD with resampling
      this.processAudioForVAD(inputChannel);
    } else {
      // Log se non riceviamo input
      if (this.processCallCount % 1000 === 0) {
        console.log(`AudioWorklet: No input data at call ${this.processCallCount}`);
      }
    }

    return true;
  }

  processAudioForVAD(audioData) {
    if (!audioData || audioData.length === 0) {
      return;
    }

    // Simple linear interpolation resampling
    if (Math.abs(this.resampleRatio - 1.0) < 0.1) {
      // No significant resampling needed
      this.addToBuffer(audioData);
    } else {
      // Resample the audio data
      const resampledData = this.resample(audioData);
      this.addToBuffer(resampledData);
    }
  }

  resample(inputData) {
    if (inputData.length === 0) return new Float32Array(0);

    const outputLength = Math.floor(inputData.length / this.resampleRatio);
    if (outputLength <= 0) return new Float32Array(0);

    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * this.resampleRatio;
      const sourceIndexFloor = Math.floor(sourceIndex);
      const sourceIndexCeil = Math.min(sourceIndexFloor + 1, inputData.length - 1);
      const fraction = sourceIndex - sourceIndexFloor;

      // Linear interpolation
      output[i] = inputData[sourceIndexFloor] * (1 - fraction) +
        inputData[sourceIndexCeil] * fraction;
    }

    return output;
  }

  addToBuffer(audioData) {
    for (let i = 0; i < audioData.length; i++) {
      this.buffer[this.bufferIndex] = audioData[i];
      this.bufferIndex++;

      if (this.bufferIndex >= this.bufferSize) {
        // Send the complete buffer to the main thread
        const bufferCopy = new Float32Array(this.buffer);
        this.port.postMessage(bufferCopy);
        this.buffersSent++;
        this.bufferIndex = 0;

        if (this.buffersSent <= 5) {
          console.log(`AudioWorklet: Sent buffer ${this.buffersSent}, size: ${bufferCopy.length}`);
        }
      }
    }
  }
}

registerProcessor('vad-processor', VADProcessor);
