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
    this.resampleBuffer = [];
    this.resampleIndex = 0;

    console.log(`VAD Processor initialized: ${this.sourceSampleRate}Hz -> ${this.targetSampleRate}Hz (ratio: ${this.resampleRatio})`);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length > 0) {
      const inputChannel = input[0];

      // Copy input to output (passthrough)
      if (output.length > 0) {
        output[0].set(inputChannel);
      }

      // Process audio for VAD with resampling
      this.processAudioForVAD(inputChannel);
    }

    return true;
  }

  processAudioForVAD(audioData) {
    // Simple linear interpolation resampling
    if (Math.abs(this.resampleRatio - 1.0) < 0.01) {
      // No resampling needed
      this.addToBuffer(audioData);
    } else {
      // Resample the audio data
      const resampledData = this.resample(audioData);
      this.addToBuffer(resampledData);
    }
  }

  resample(inputData) {
    const outputLength = Math.floor(inputData.length / this.resampleRatio);
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
        // Send complete buffer to main thread
        const bufferCopy = new Float32Array(this.buffer);
        this.port.postMessage(bufferCopy);
        this.bufferIndex = 0;
      }
    }
  }
}

registerProcessor('vad-processor', VADProcessor);
