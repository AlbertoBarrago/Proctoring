import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {catchError, Observable, tap} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProctoringService {
  private apiUrl = 'http://localhost:8000/api/proctoring';
  public sessionStartTime: number = 0;

  constructor(private http: HttpClient) { }

  startSession(): Observable<any> {
    const data = {
      user_id: 1,
      exam_id: '1'
    };
    return this.http.post(`${this.apiUrl}/start`, data, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }).pipe(
      tap((response: any) => console.log('Response:', response)),
      catchError(error => {
        console.error('Error:', error);
        throw error;
      })
    );
  }

  endSession(sessionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/end`, { session_id: sessionId });
  }

  recordViolation(sessionId: string, type: string, timestamp: number, details: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/violation`, {
      session_id: sessionId,
      type: type,
      timestamp: timestamp,
      details: details
    });
  }

  getSessions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/sessions`);
  }

  getSessionDetails(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/session/${sessionId}`);
  }
}
