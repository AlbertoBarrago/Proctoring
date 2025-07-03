import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaceDetectionService } from '../services/face-detection.service';
import { ScreenRecordingService } from '../services/screen-recording.service';
import { WebSocketService } from '../services/websocket.service';
import { Subscription } from 'rxjs';
import * as faceapi from 'face-api.js';
import { ProctoringService } from "../services/proctoring.service";
import {EnvironmentService} from "../services/environment.service";

@Component({
  selector: 'app-proctoring',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proctoring.component.html',
  styleUrl: './proctoring.component.css'
})
export class ProctoringComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElementRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('overlayCanvas') overlayCanvasRef!: ElementRef<HTMLCanvasElement>;

  private videoStream: MediaStream | null = null;
  private detectionInterval: any;
  private pusherSubscription: Subscription | undefined;
  private violationCount: number = 0;

  isProctoringActive: boolean = false;
  isRecordingActive: boolean = false;
  sessionId: string | null = null;
  sessionStatus: string = 'Inactive';
  faceDetectionStatus: string = 'Loading models...';
  numFaces: number | null = null;
  faceDirection: string = '';
  violationMessage: string = '';
  pusherMessage: string = '';
  isRecordingVideo: boolean = false;

  constructor(
    private proctoringService: ProctoringService,
    private faceDetectionService: FaceDetectionService,
    private screenRecordingService: ScreenRecordingService,
    private webSocketService: WebSocketService,
    private environmentService: EnvironmentService
  ) {}


  ngOnInit(): void {
    this.initializeWebSocket();
    this.checkRecordingState();
  }

  private checkRecordingState(): void {
    setInterval(() => {
      this.isRecordingActive = this.screenRecordingService.isRecordingActive();
    }, 1000);
  }
  async ngAfterViewInit(): Promise<void> {
    try {
      await this.faceDetectionService.loadModels();
      this.faceDetectionStatus = 'Models loaded. Ready.';
    } catch (error) {
      console.error('Error loading face detection models:', error);
      this.faceDetectionStatus = 'Failed to load models';
    }
  }

  async startScreenRecording(): Promise<void> {
    if (!this.sessionId) {
      this.violationMessage = 'Cannot start recording: No active session.';
      return;
    }

    console.log('Attempting to start screen recording...');

    try {
      this.violationMessage = '';

      // Start the recording
      await this.screenRecordingService.startRecording();

      this.isRecordingActive = true;
      console.log('Screen recording started successfully.');
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      this.violationMessage = 'Failed to start screen recording. Please check browser permissions.';
    }
  }


  async stopScreenRecording(): Promise<void> {
    if (!this.isRecordingActive || !this.sessionId) return;

    try {
      const recordedBlob = await this.screenRecordingService.stopRecording();

      this.isRecordingActive = false;

      if (recordedBlob && recordedBlob.size > 0) {
        console.log('Screen recording stopped. Uploading...', recordedBlob);
        await this.screenRecordingService.uploadRecording(this.sessionId, recordedBlob);
        console.log('Screen recording uploaded successfully.');
      } else {
        console.log('No recording data available to upload');
      }
    } catch (error) {
      console.error('Failed to stop or upload screen recording:', error);
      this.violationMessage = 'Failed to stop or upload screen recording.';
      this.isRecordingActive = false;
    }
  }

  private initializeWebSocket(): void {
    this.webSocketService.connect();
    this.pusherSubscription = this.webSocketService.subscribeToChannel('test-channel').subscribe({
      next: (event: { eventName: string, data: any }) => {
        if (event.eventName === 'test-message') {
          this.pusherMessage = `Backend message: ${event.data.message}`;
          console.log('Pusher event received:', event.data);
        }
      },
      error: (error: any) => {
        console.error('Error receiving Pusher message:', error);
      }
    });
  }

  async startProctoring(): Promise<void> {
    try {
      const sessionResponse = await this.proctoringService.startSession().toPromise();
      this.sessionId = sessionResponse.session_id;
      this.sessionStatus = 'Active';
      this.isProctoringActive = true;
      this.violationMessage = '';

      await this.initializeWebcam();
      await this.startFaceDetection();
      await this.startScreenRecording();

      console.log('Proctoring started for session:', this.sessionId);
    } catch (error: any) {
      console.error('Error starting proctoring:', error);
      this.handleProctoringError(error);
    }
  }

  private async initializeWebcam(): Promise<void> {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });

      const video = this.videoElementRef.nativeElement;
      video.srcObject = this.videoStream;
      await video.play();

      // Set canvas dimensions
      const canvas = this.overlayCanvasRef.nativeElement;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    } catch (error) {
      console.error('Error initializing webcam:', error);
      throw new Error('Failed to initialize webcam');
    }
  }

  private async startFaceDetection(): Promise<void> {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    const video = this.videoElementRef.nativeElement;
    const canvas = this.overlayCanvasRef.nativeElement;

    if (!video.srcObject) {
      throw new Error('Video source not initialized');
    }

    this.detectionInterval = setInterval(async () => {
      if (!this.isProctoringActive) return;

      try {
        await this.performFaceDetection(video, canvas);
      } catch (error) {
        console.error('Error in face detection interval:', error);
      }
    }, 1000);
  }

  private async performFaceDetection(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> {
    const detections = await this.faceDetectionService.detectFaces(video);
    const displaySize = { width: video.videoWidth, height: video.videoHeight };

    this.updateCanvas(canvas, detections, displaySize);
    this.updateFaceStatus(detections);
    await this.checkViolations(detections, video);
  }

  private updateCanvas(canvas: HTMLCanvasElement, detections: any[], displaySize: { width: number; height: number }): void {
    faceapi.matchDimensions(canvas, displaySize);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      faceapi.draw.drawDetections(canvas, resizedDetections);
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    }
  }

  private updateFaceStatus(detections: any[]): void {
    this.numFaces = detections.length;
    console.log('Number of faces detected:', this.numFaces);
  }

  private async checkViolations(detections: any[], video: HTMLVideoElement): Promise<void> {
    if (this.numFaces && this.numFaces > 1) {
      await this.handleViolation('multiple_faces', 'Multiple faces detected');
    } else if (this.numFaces === 0) {
      await this.handleViolation('no_face', 'No face detected');
    } else {
      await this.checkFaceDirection(video);
    }
  }

  private async checkFaceDirection(video: HTMLVideoElement): Promise<void> {
    const direction = await this.faceDetectionService.detectFaceDirection(video);
    this.faceDirection = direction;
    if (direction !== 'looking-forward' && direction !== 'no-face') {
      await this.handleViolation('looking_away', `Looking ${direction}`);
    } else {
      this.violationMessage = '';
    }
  }

  private async handleViolation(type: string, details: string): Promise<void> {
    this.violationMessage = `VIOLATION: ${details}`;
    this.violationCount++;
    if (this.violationCount % 5 === 0 && this.sessionId) {
      const timestamp = Math.floor((Date.now() - (this.proctoringService.sessionStartTime || Date.now())) / 1000);
      const sessionIdString = String(this.sessionId);
      this.proctoringService.recordViolation(sessionIdString, type, timestamp, details).subscribe({
        next: () => console.log('Violation recorded:', type),
        error: (err) => console.error('Failed to record violation:', err)
      });
    }
  }

  async endProctoring(): Promise<void> {
    if (!this.isProctoringActive || !this.sessionId) return;

    try {
      console.log('Starting end proctoring process for session:', this.sessionId);

      this.stopFaceDetection();

      if (this.isRecordingActive) {
        try {
          await this.stopScreenRecording();
        } catch (recordingError) {
          console.error('Error stopping screen recording:', recordingError);
          this.isRecordingActive = false;
        }
      }

      this.stopWebcam();

      const sessionIdToEnd = String(this.sessionId);

      this.proctoringService.endSession(sessionIdToEnd).subscribe({
        next: (response) => {
          console.log('Session ended successfully on server:', response);
          this.sessionStatus = 'Completed';
          this.isProctoringActive = false;

          const endedSessionId = this.sessionId;
          this.sessionId = null;
          this.violationMessage = '';
          this.numFaces = null;
          this.faceDirection = '';

          console.log('Proctoring session ended:', endedSessionId);
        },
        error: (error) => {
          console.error('Error ending session on server:', error);
          this.sessionStatus = 'Completed with errors';
          this.violationMessage = error.error?.message || 'Failed to end proctoring session on server.';
        },
        complete: () => {
          this.stopProctoringCleanup();
        }
      });
    } catch (error: any) {
      console.error('Error during end proctoring process:', error);
      this.sessionStatus = 'Completed with errors';
      this.violationMessage = error.message || 'Failed to end proctoring session.';
      this.stopProctoringCleanup();
    }
  }

  private stopFaceDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      this.faceDetectionStatus = 'Inactive';
      this.clearCanvas();
    }
  }

  private clearCanvas(): void {
    const canvas = this.overlayCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private stopWebcam(): void {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
      this.videoElementRef.nativeElement.srcObject = null;
    }
  }

  private handleProctoringError(error: any): void {
    this.sessionStatus = 'Failed to start';
    this.violationMessage = error.error?.message || 'Failed to start proctoring session.';
    this.stopProctoringCleanup();
  }

  private stopProctoringCleanup(): void {
    this.stopWebcam();
    this.stopFaceDetection();
    if (this.isRecordingActive) {
      this.screenRecordingService.stopRecording();
      this.isRecordingActive = false;
    }
    this.isProctoringActive = false;
    this.sessionStatus = 'Inactive';
    this.sessionId = null;
    this.numFaces = null;
    this.faceDirection = '';
    this.violationMessage = '';
    this.violationCount = 0;
  }

  ngOnDestroy(): void {
    this.stopProctoringCleanup();
    if (this.pusherSubscription) {
      this.pusherSubscription.unsubscribe();
    }
    this.webSocketService.disconnect();
  }
}
