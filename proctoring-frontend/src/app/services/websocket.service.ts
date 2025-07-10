import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import Pusher from "pusher-js";
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private pusher: Pusher | null = null;
  private PUSHER_APP_KEY = environment.PUSHER_APP_KEY;
  private PUSHER_APP_CLUSTER = environment.PUSHER_APP_CLUSTER;

  constructor() { }
  connect(): void {
    if (!this.pusher) {
      this.pusher = new Pusher(this.PUSHER_APP_KEY, {
        cluster: this.PUSHER_APP_CLUSTER,
      });

      console.log('Pusher client connected.');
    }
  }

  subscribeToChannel(channelName: string): Observable<any> {
    if (!this.pusher) {
      this.connect();
    }
    const channel = this.pusher!.subscribe(channelName);
    const eventSubject = new Subject<any>();

    channel.bind_global((eventName: string, data: any) => {
      eventSubject.next({ eventName, data });
    });

    return eventSubject.asObservable();
  }

  disconnect(): void {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
      console.log('Pusher client disconnected.');
    }
  }
}
