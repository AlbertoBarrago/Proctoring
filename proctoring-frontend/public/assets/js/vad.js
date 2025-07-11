/**
 * @class VADProcessor
 * @extends AudioWorkletProcessor
 *
 * This class is a custom AudioWorkletProcessor for Voice Activity Detection (VAD).
 * It processes audio data, resamples it to a target sample rate, and sends it to the main thread in fixed-size buffers.
 */
class VADProcessor extends AudioWorkletProcessor {
  /**
   * @constructor
   * @param {object} options - The options for the processor.
   * @param {object} options.processorOptions - The options for the processor.
   * @param {number} options.processorOptions.targetSampleRate - The target sample rate for the audio data.
   * @param {number} options.processorOptions.sourceSampleRate - The source sample rate of the audio data.
   */
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

  /**
   * This method is called by the audio worklet system to process audio data.
   * @param {Array<Array<Float32Array>>} inputs - The input audio data.
   * @param {Array<Array<Float32Array>>} outputs - The output audio data.
   * @param {object} parameters - The parameters for the processor.
   * @returns {boolean} - Always returns true to keep the processor alive.
   */
  process(inputs, outputs, parameters) {
    this.processCallCount++;

    const input = inputs[0];

    if (input && input.length > 0 && input[0]) {
      const inputChannel = input[0];

      // Debug logging every 1000 calls
    /*   if (this.processCallCount % 1000 === 0) {
        console.log(`AudioWorklet: Processed ${this.processCallCount} calls, sent ${this.buffersSent} buffers, input size: ${inputChannel.length}`);
      }
    */
      // Process audio for VAD with resampling
      this.processAudioForVAD(inputChannel);
    } else {
      if (this.processCallCount % 1000 === 0) {
        console.log(`AudioWorklet: No input data at call ${this.processCallCount}`);
      }
    }

    return true;
  }

  /**
   * This method processes the audio data for VAD.
   * It resamples the audio data if necessary and adds it to the buffer.
   * @param {Float32Array} audioData - The audio data to process.
   */
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

  /**
   * This method resamples the audio data using linear interpolation.
   * @param {Float32Array} inputData - The input audio data to resample.
   * @returns {Float32Array} - The resampled audio data.
   */
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

  /**
   * This method adds audio data to the buffer.
   * When the buffer is full, it sends the buffer to the main thread.
   * @param {Float32Array} audioData - The audio data to add to the buffer.
   */
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
