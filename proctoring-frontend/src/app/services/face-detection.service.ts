import { Injectable } from '@angular/core';
import * as faceapi from 'face-api.js';

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionService {
  private modelsLoaded = false;

  async loadModels(): Promise<void> {
    const MODEL_URL = '/assets/models';

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);

    this.modelsLoaded = true;
  }

  async detectFaces(video: HTMLVideoElement): Promise<any[]> {
    if (!this.modelsLoaded) {
      await this.loadModels();
    }

    return await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();
  }

  async detectMultipleFaces(video: HTMLVideoElement): Promise<boolean> {
    const detections = await this.detectFaces(video);
    return detections.length > 1;
  }

  async detectFaceDirection(video: HTMLVideoElement): Promise<string> {
    const detections = await this.detectFaces(video);

    if (detections.length === 0) return 'no-face';

    const landmarks = detections[0].landmarks;
    const jawLine = landmarks.getJawOutline();
    const nose = landmarks.getNose();

    // Simple direction detection based on nose position relative to face
    const faceCenter = jawLine.reduce((sum: any, point: any) =>
      ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    faceCenter.x /= jawLine.length;
    faceCenter.y /= jawLine.length;

    const noseCenter = nose[3]; // Nose tip

    if (noseCenter.x < faceCenter.x - 10) return 'looking-left';
    if (noseCenter.x > faceCenter.x + 10) return 'looking-right';
    if (noseCenter.y < faceCenter.y - 10) return 'looking-up';
    if (noseCenter.y > faceCenter.y + 10) return 'looking-down';

    return 'looking-forward';
  }
}
