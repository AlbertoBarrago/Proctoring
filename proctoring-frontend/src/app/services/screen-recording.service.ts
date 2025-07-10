import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ScreenRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  private stopPromise: Promise<Blob> | null = null;
  private stopResolve: ((blob: Blob) => void) | null = null;

  /**
   * Gets the best supported MIME type for recording
   */
  private getBestSupportedMimeType(): string {
    const mimeTypes = [
      'video/webm',
      'video/mp4',
      'video/webm;codecs=vp8',
      'video/webm;codecs=h264'
    ];

    for (const type of mimeTypes) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          console.log(`Using supported MIME type: ${type}`);
          return type;
        }
      } catch (e) {
        console.warn(`Error checking support for ${type}:`, e);
      }
    }

    console.warn('No preferred MIME types supported, using default');
    return '';
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('Recording is already active');
      return;
    }

    try {
      // Clean up any previous recording state
      this.cleanup();

      console.log('Requesting screen sharing permission...');

      const combinedStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          sampleSize: 16,
          channelCount: 2,
          deviceId: 'default'
        },
      });

      this.mediaStream = combinedStream;

      combinedStream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('User stopped screen sharing');
        if (this.isRecording) {
          this.internalStopRecording();
        }
      });

      // Reset recording state
      this.recordedChunks = [];
      this.isRecording = true;

      // Get a supported MIME type
      const mimeType = this.getBestSupportedMimeType();

      // Create MediaRecorder with appropriate options
      const options = mimeType ? { mimeType } : undefined;

      console.log('Creating MediaRecorder with options:', options);
      this.mediaRecorder = new MediaRecorder(combinedStream, options);
      console.log('MediaRecorder created with MIME type:', this.mediaRecorder.mimeType);

      // Set up data event handler
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('Data available event, size:', event.data.size);
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, chunks:', this.recordedChunks.length);
        if (this.stopResolve && this.recordedChunks.length > 0) {
          // Create the final blob
          const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder?.mimeType || 'video/webm'
          });
          console.log('Created final blob, size:', blob.size, 'type:', blob.type);
          this.stopResolve(blob);
        } else if (this.stopResolve) {
          console.error('No recorded chunks available after stop');
          this.stopResolve(new Blob([], { type: 'video/webm' }));
        }
      };

      // Start recording with a shorter interval to get more chunks
      this.mediaRecorder.start(500);
      console.log('Recording started');
    } catch (error) {
      this.isRecording = false;
      console.error('Error starting screen recording:', error);
      this.cleanup();
      throw error;
    }
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      console.warn('No active recording to stop');
      return null;
    }

    console.log('Stopping recording...');

    this.stopPromise = new Promise<Blob>((resolve) => {
      this.stopResolve = resolve;
    });

    this.internalStopRecording();

    try {
      const blob = await this.stopPromise;
      console.log('Recording stopped successfully, blob size:', blob.size);
      return blob;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    } finally {
      this.cleanup();
    }
  }

  private internalStopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        // Request final data
        this.mediaRecorder.requestData();

        // Give a little time for the data to be processed
        setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            console.log('MediaRecorder.stop() called');
          }
        }, 200);
      } catch (error) {
        console.error('Error in internalStopRecording:', error);
        if (this.stopResolve) {
          if (this.recordedChunks.length > 0) {
            const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
            const blob = new Blob(this.recordedChunks, { type: mimeType });
            this.stopResolve(blob);
          } else {
            console.error('No chunks available to create blob');
            this.stopResolve(new Blob([], { type: 'video/webm' }));
          }
        }
      }
    } else if (this.stopResolve && this.recordedChunks.length > 0) {
      const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      this.stopResolve(blob);
    } else if (this.stopResolve) {
      console.error('No chunks available to create blob (recorder inactive)');
      this.stopResolve(new Blob([], { type: 'video/webm' }));
    }
  }

  async uploadRecording(sessionId: string, blob: Blob): Promise<void> {
    if (!blob || blob.size === 0) {
      console.warn('No valid blob to upload');
      return;
    }

    try {
      const totalSize = blob.size;
      const chunks = Math.ceil(totalSize / this.CHUNK_SIZE);

      console.log(`Uploading recording: ${totalSize} bytes in ${chunks} chunks, type: ${blob.type}`);

      // Extract file extension based on MIME type
      const fileExtension = blob.type.includes('mp4') ? 'mp4' : 'webm';

      for (let i = 0; i < chunks; i++) {
        const start = i * this.CHUNK_SIZE;
        const end = Math.min(start + this.CHUNK_SIZE, totalSize);
        const chunkBlob = blob.slice(start, end);

        if (chunkBlob.size === 0) {
          console.warn(`Skipping empty chunk ${i}`);
          continue;
        }

        const file = new File([chunkBlob], `chunk-${i}.${fileExtension}`, {
          type: blob.type,
          lastModified: Date.now()
        });

        const formData = new FormData();
        formData.append('session_id', sessionId);
        formData.append('chunk_index', i.toString());
        formData.append('total_chunks', chunks.toString());
        formData.append('recording_chunk', file);

        console.log(`Uploading chunk ${i+1}/${chunks}, size: ${file.size} bytes`);

        try {
          const response = await fetch('http://localhost:8000/api/proctoring/upload-chunk', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error(`Chunk ${i+1}/${chunks} upload failed:`, errorData);
            throw new Error(`Upload failed: ${errorData.message || response.statusText}`);
          }

          console.log(`Chunk ${i+1}/${chunks} uploaded successfully`);
        } catch (chunkError) {
          console.error(`Error uploading chunk ${i+1}/${chunks}:`, chunkError);
          // Add a retry mechanism
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.warn(`Continuing to next chunk after error in chunk ${i+1}`);
        }
      }

      console.log('All chunks uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  private cleanup(): void {
    console.log('Cleaning up recording resources');

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
          console.log(`Stopped track: ${track.kind}`);
        }
      });
      this.mediaStream = null;
    }

    this.mediaRecorder = null;
    this.isRecording = false;
    this.stopPromise = null;
    this.stopResolve = null;
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }
}
