import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ScreenRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks


  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopRecording();
      });

      this.mediaRecorder = new MediaRecorder(stream);
      this.recordedChunks = [];
      this.isRecording = true;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Record in 1-second chunks
    } catch (error) {
      this.isRecording = false;
      console.error('Error starting screen recording:', error);
      throw error;
    }
  }

  stopRecording(): Blob | null {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      this.cleanup();
      return blob;
    }
    return null;
  }

  async uploadRecording(sessionId: string, blob: Blob): Promise<void> {
    try {
      const totalSize = blob.size;
      const chunks = Math.ceil(totalSize / this.CHUNK_SIZE);

      for (let i = 0; i < chunks; i++) {
        const start = i * this.CHUNK_SIZE;
        const end = Math.min(start + this.CHUNK_SIZE, totalSize);
        const chunk = blob.slice(start, end);

        const file = new File([chunk], `chunk-${i}.webm`, { type: 'video/webm' });

        const formData = new FormData();
        formData.append('session_id', sessionId);
        formData.append('chunk_index', i.toString());
        formData.append('total_chunks', chunks.toString());
        formData.append('recording_chunk', file);

        // Log per debug
        console.log('Uploading chunk:', i, 'Size:', file.size);

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
          throw new Error(`Upload failed: ${errorData.message || response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }


  private cleanup(): void {
    if (this.mediaRecorder) {
      const stream = this.mediaRecorder.stream;
      stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
    this.recordedChunks = [];
    this.isRecording = false;
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }
}
