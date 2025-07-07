import { Injectable } from '@angular/core';
import * as faceapi from 'face-api.js';

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionService {
  private modelsLoaded = false;
  private readonly MODEL_URL = '/assets/models';

  async loadModels(): Promise<void> {
    try {
      if (this.modelsLoaded) {
        console.log('Face detection models already loaded');
        return;
      }

      console.log('Loading face detection models...');

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL)
      ]);

      this.modelsLoaded = true;
      console.log('Face detection models loaded successfully');
    } catch (error) {
      console.error('Error loading face detection models:', error);
      this.modelsLoaded = false;
      throw error;
    }
  }

  async detectFaces(video: HTMLVideoElement): Promise<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>[]> {
    if (!video.srcObject) {
      console.error('No video source');
      return [];
    }

    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5
        }))
        .withFaceLandmarks();

      console.log(`Detected ${detections.length} faces`);
      return detections;

    } catch (error) {
      console.error('Error detecting faces:', error);
      return [];
    }
  }

  async detectFaceDirection(video: HTMLVideoElement): Promise<string> {
    try {
      const detections = await this.detectFaces(video);

      if (detections.length === 0) {
        return 'no-face';
      }

      const landmarks = detections[0].landmarks;
      const nose = landmarks.getNose();
      const jawOutline = landmarks.getJawOutline();

      const faceCenter = {
        x: jawOutline.reduce((sum, point) => sum + point.x, 0) / jawOutline.length,
        y: jawOutline.reduce((sum, point) => sum + point.y, 0) / jawOutline.length
      };

      const noseTip = nose[3];
      const threshold = 15;

      if (Math.abs(noseTip.x - faceCenter.x) < threshold &&
        Math.abs(noseTip.y - faceCenter.y) < threshold) {
        return 'looking-forward';
      }

      if (noseTip.x < faceCenter.x - threshold) return 'looking-left';
      if (noseTip.x > faceCenter.x + threshold) return 'looking-right';
      if (noseTip.y < faceCenter.y - threshold) return 'looking-up';
      if (noseTip.y > faceCenter.y + threshold) return 'looking-down';

      return 'looking-forward';
    } catch (error) {
      console.error('Error detecting face direction:', error);
      return 'no-face';
    }
  }
}
