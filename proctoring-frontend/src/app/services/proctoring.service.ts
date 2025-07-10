import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {catchError, Observable, tap} from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProctoringService {
  private apiUrl = `${environment.API_URL}/proctoring`;
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
    console.log('Ending session:', sessionId);
    return this.http.post(`${this.apiUrl}/end`, { session_id: String(sessionId) }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }).pipe(
      tap((response: any) => console.log('Session ended successfully:', response)),
      catchError(error => {
        console.error('Error ending session:', error);
        throw error;
      })
    );
  }


  recordViolation(sessionId: string, type: string, timestamp: number, details: string): Observable<any> {
    console.log('Recording violation:', sessionId, type, timestamp, details);
    return this.http.post(`${this.apiUrl}/violation`, {
      session_id: sessionId,
      type: type,
      timestamp: timestamp,
      details: details
    });
  }
}
