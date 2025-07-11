import { Injectable } from '@angular/core';
import * as faceapi from 'face-api.js';
import {FaceDirectionResult} from "../interfaces";

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionService {
  private modelsLoaded = false;
  private readonly MODEL_URL = '/assets/models';
  private directionHistory: string[] = [];
  private historySize = 5;
  private lastDetectionTime = 0;
  private readonly detectionCooldown = 33;

  async loadModels(): Promise<void> {
    try {
      if (this.modelsLoaded) {
        console.log('Face detection models already loaded');
        return;
      }

      console.log('Loading face detection models...');

      const loadPromises = [
        await faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL),
        await faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL)
      ];

      await Promise.race([
        Promise.all(loadPromises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Model loading timeout')), 30000)
        )
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

    // Throttle detection calls
    const now = Date.now();
    if (now - this.lastDetectionTime < this.detectionCooldown) {
      return [];
    }
    this.lastDetectionTime = now;

    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }

      // Check if video is ready
      if (video.readyState < 2) {
        console.warn('Video not ready for face detection');
        return [];
      }

      const videoArea = video.videoWidth * video.videoHeight;
      const inputSize = videoArea > 640 * 480 ? 320 : 224;
      const scoreThreshold = videoArea > 640 * 480 ? 0.5 : 0.6;

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
          inputSize,
          scoreThreshold
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

      const detection = detections[0];
      const landmarks = detection.landmarks;

      // Get multiple reference points for better accuracy
      const nose = landmarks.getNose();
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const mouth = landmarks.getMouth();

      // Calculate more stable reference points
      const eyeCenter = {
        x: (leftEye[0].x + rightEye[3].x) / 2,
        y: (leftEye[0].y + rightEye[3].y) / 2
      };

      const noseTip = nose[3]; // Nose tip
      const noseBridge = nose[0]; // Nose bridge (more stable)

      // Calculate face dimensions for adaptive thresholds
      const faceWidth = Math.abs(rightEye[3].x - leftEye[0].x);
      const faceHeight = Math.abs(mouth[3].y - eyeCenter.y);

      // Adaptive thresholds based on face size and detection confidence
      const detectionScore = detection.detection.score;
      const sizeMultiplier = Math.max(0.5, Math.min(faceWidth, faceHeight) / 100);
      const confidenceMultiplier = Math.max(0.6, detectionScore);

      const horizontalThreshold = faceWidth * 0.15 * sizeMultiplier * confidenceMultiplier;
      const verticalThreshold = faceWidth * 0.12 * sizeMultiplier * confidenceMultiplier;

      // Calculate relative positions using more stable reference
      const horizontalOffset = noseTip.x - eyeCenter.x;
      const verticalOffset = noseTip.y - eyeCenter.y;

      // Additional stability check using nose bridge
      const bridgeHorizontalOffset = noseBridge.x - eyeCenter.x;
      const avgHorizontalOffset = (horizontalOffset + bridgeHorizontalOffset) / 2;

      // Determine direction with improved logic
      let direction = 'looking-forward';

      // Check horizontal direction
      if (Math.abs(avgHorizontalOffset) > horizontalThreshold) {
        if (avgHorizontalOffset > 0) {
          direction = 'looking-right';
        } else {
          direction = 'looking-left';
        }
      }

      // Check vertical direction (can combine with horizontal)
      if (Math.abs(verticalOffset) > verticalThreshold) {
        const verticalDir = verticalOffset > 0 ? 'down' : 'up';
        if (direction !== 'looking-forward') {
          // Combine directions (e.g., "looking-up-left")
          direction = `looking-${verticalDir}-${direction.split('-')[1]}`;
        } else {
          direction = `looking-${verticalDir}`;
        }
      }

      // Apply temporal smoothing
      const smoothedDirection = this.smoothDirection(direction);

      return smoothedDirection;

    } catch (error) {
      console.error('Error detecting face direction:', error);
      return 'no-face';
    }
  }

  async detectFaceDirectionWithDetails(video: HTMLVideoElement): Promise<FaceDirectionResult> {
    try {
      const detections = await this.detectFaces(video);

      if (detections.length === 0) {
        return { direction: 'no-face', confidence: 0 };
      }

      const detection = detections[0];
      const landmarks = detection.landmarks;

      const pose = this.calculateHeadPose(landmarks);

      const direction = await this.detectFaceDirection(video);

      const detectionConfidence = detection.detection.score;
      const poseConfidence = Math.min(
        1.0,
        (Math.abs(pose.yaw) + Math.abs(pose.pitch)) / 45
      );

      const overallConfidence = (detectionConfidence + poseConfidence) / 2;

      return {
        direction,
        confidence: Math.round(overallConfidence * 100) / 100,
        angle: pose
      };

    } catch (error) {
      console.error('Error detecting face direction with details:', error);
      return { direction: 'no-face', confidence: 0 };
    }
  }

  private smoothDirection(currentDirection: string): string {
    this.directionHistory.push(currentDirection);

    if (this.directionHistory.length > this.historySize) {
      this.directionHistory.shift();
    }

    const counts = this.directionHistory.reduce((acc, dir) => {
      acc[dir] = (acc[dir] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).reduce((a, b) =>
      counts[a[0]] > counts[b[0]] ? a : b
    )[0];
  }

  private calculateHeadPose(landmarks: any): { yaw: number; pitch: number } {
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // Calculate head rotation using eye-nose triangle
    const eyeCenter = {
      x: (leftEye[0].x + rightEye[3].x) / 2,
      y: (leftEye[0].y + rightEye[3].y) / 2
    };

    const noseVector = {
      x: nose[3].x - eyeCenter.x,
      y: nose[3].y - eyeCenter.y
    };

    const eyeVector = {
      x: rightEye[3].x - leftEye[0].x,
      y: rightEye[3].y - leftEye[0].y
    };

    // Calculate angles in degrees
    const yawAngle = Math.atan2(noseVector.x, Math.abs(noseVector.y)) * (180 / Math.PI);
    const pitchAngle = Math.atan2(noseVector.y, Math.abs(noseVector.x)) * (180 / Math.PI);

    return {
      yaw: Math.round(yawAngle * 100) / 100,
      pitch: Math.round(pitchAngle * 100) / 100
    };
  }

  // Utility methods for advanced usage
  clearHistory(): void {
    this.directionHistory = [];
  }

  getModelsLoadedStatus(): boolean {
    return this.modelsLoaded;
  }

  setHistorySize(size: number): void {
    this.historySize = Math.max(1, Math.min(size, 10));
  }
}
