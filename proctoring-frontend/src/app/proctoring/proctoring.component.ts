import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaceDetectionService } from '../services/face-detection.service';
import { ScreenRecordingService } from '../services/screen-recording.service';
import { WebSocketService } from '../services/websocket.service';
import { Subscription } from 'rxjs';
import * as faceapi from 'face-api.js';
import {ProctoringService} from "../services/proctoring.service";

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
  private currentSessionId: string | null = null;
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

  constructor(
    private proctoringService: ProctoringService,
    private faceDetectionService: FaceDetectionService,
    private screenRecordingService: ScreenRecordingService,
    private webSocketService: WebSocketService,
  ) { }

  ngOnInit(): void {
    this.webSocketService.connect();
    this.pusherSubscription = this.webSocketService.subscribeToChannel('test-channel').subscribe(
      (event: { eventName: string, data: any }) => {
        if (event.eventName === 'test-message') {
          this.pusherMessage = `Backend message: ${event.data.message}`;
          console.log('Pusher event received:', event.data);
        }
      },
      (error: any) => {
        console.error('Error receiving Pusher message:', error);
      }
    );
  }

  async ngAfterViewInit(): Promise<void> {
    await this.faceDetectionService.loadModels();
    this.faceDetectionStatus = 'Models loaded. Ready.';
  }

  async startProctoring(): Promise<void> {
    try {

      const sessionResponse = await this.proctoringService.startSession().toPromise();
      this.sessionId = sessionResponse.session_id;
      this.sessionStatus = 'Active';
      this.isProctoringActive = true;
      this.violationMessage = '';


      this.videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoElementRef.nativeElement.srcObject = this.videoStream;
      await this.videoElementRef.nativeElement.play();

      await this.startScreenRecording();

      console.log('Proctoring started for session:', this.sessionId);

    } catch (error: any) {
      console.error('Error starting proctoring:', error);
      this.sessionStatus = 'Failed to start';
      this.violationMessage = error.error?.message || 'Failed to start proctoring session.';
      this.stopProctoringCleanup();
    }
  }

  async endProctoring(): Promise<void> {
    if (!this.isProctoringActive || !this.sessionId) return;

    try {
      this.stopFaceDetection();

      if (this.isRecordingActive) {
        await this.stopScreenRecording();
      }

      this.stopWebcam();

      await this.proctoringService.endSession(this.sessionId).toPromise();
      this.sessionStatus = 'Completed';
      this.isProctoringActive = false;
      console.log('Proctoring session ended:', this.sessionId);
      this.currentSessionId = null;
      this.sessionId = null;
      this.violationMessage = '';
      this.numFaces = null;
      this.faceDirection = '';

    } catch (error: any) {
      console.error('Error ending proctoring:', error);
      this.sessionStatus = 'Completed with errors';
      this.violationMessage = error.error?.message || 'Failed to end proctoring session.';
    } finally {
      this.stopProctoringCleanup();
    }
  }

  private stopProctoringCleanup(): void {
    if (this.videoStream) {
      this.stopWebcam();
    }
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


  private async startFaceDetection(): Promise<void> {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    const video = this.videoElementRef.nativeElement;
    const canvas = this.overlayCanvasRef.nativeElement;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        resolve();
      };
    });

    this.detectionInterval = setInterval(async () => {
      if (!this.isProctoringActive) return;

      const displaySize = { width: video.videoWidth, height: video.videoHeight };

      if (displaySize.width === 0 || displaySize.height === 0) {
        console.log('Video dimensions not ready yet');
        return;
      }

      const detections = await this.faceDetectionService.detectFaces(video);
      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
      }

      this.numFaces = detections.length;

      if (this.numFaces > 1) {
        this.violationMessage = 'VIOLATION: Multiple faces detected!';
        this.recordViolation('multiple_faces', 'Multiple faces detected');
      } else if (this.numFaces === 0) {
        this.violationMessage = 'VIOLATION: No face detected!';
        this.recordViolation('no_face', 'No face detected');
      } else {
        const direction = await this.faceDetectionService.detectFaceDirection(video);
        this.faceDirection = direction;
        if (direction !== 'looking-forward' && direction !== 'no-face') {
          this.violationMessage = `VIOLATION: Looking ${direction}!`;
          this.recordViolation('looking_away', `Looking ${direction}`);
        } else {
          this.violationMessage = '';
        }
      }
    }, 1000);
  }

  private stopFaceDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      this.faceDetectionStatus = 'Inactive';
      // Pulisci il canvas
      const canvas = this.overlayCanvasRef.nativeElement;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  private stopWebcam(): void {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
      this.videoElementRef.nativeElement.srcObject = null;
    }
  }

  async startScreenRecording(): Promise<void> {
    if (!this.sessionId) {
      this.violationMessage = 'Cannot start recording: No active session.';
      return;
    }
    try {
      await this.screenRecordingService.startRecording();
      this.isRecordingActive = true;
      console.log('Screen recording started.');
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      this.violationMessage = 'Failed to start screen recording.';
    }
  }

  async stopScreenRecording(): Promise<void> {
    if (!this.isRecordingActive || !this.sessionId) return;
    try {
      const recordedBlob = this.screenRecordingService.stopRecording();
      if (recordedBlob) {
        console.log('Screen recording stopped. Uploading...');
        await this.screenRecordingService.uploadRecording(this.sessionId, recordedBlob);
        console.log('Screen recording uploaded successfully.');
      }
      this.isRecordingActive = false;
    } catch (error) {
      console.error('Failed to stop or upload screen recording:', error);
      this.violationMessage = 'Failed to stop or upload screen recording.';
    }
  }

  private recordViolation(type: string, details: string): void {
    if (!this.sessionId) {
      console.warn('Attempted to record violation without active session ID.');
      return;
    }
    // Limita il numero di violazioni inviate per evitare spamming dell'API
    // Potresti implementare un debounce o un throttle qui.
    // Per semplicità, aumentiamo un contatore e inviamo ogni X secondi/violazioni.
    this.violationCount++;
    if (this.violationCount % 5 === 0) { // Invia una violazione ogni 5 rilevamenti
      const timestamp = Math.floor((Date.now() - (this.proctoringService.sessionStartTime || Date.now())) / 1000); // Tempo dalla partenza
      this.proctoringService.recordViolation(this.sessionId, type, timestamp, details).subscribe({
        next: () => console.log('Violation sent to backend:', type),
        error: (err) => console.error('Failed to send violation:', err)
      });
    }
  }


  ngOnDestroy(): void {
    this.stopProctoringCleanup(); // Assicurati di pulire tutto alla distruzione del componente
    if (this.pusherSubscription) {
      this.pusherSubscription.unsubscribe();
    }
    this.webSocketService.disconnect();
  }
}
