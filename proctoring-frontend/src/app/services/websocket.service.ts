// websocket.service.ts
import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import Pusher from "pusher-js";

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private pusher: Pusher | null = null;
  private messagesSubject = new Subject<any>();

  private PUSHER_APP_KEY = '4a69587135815058288d';
  private PUSHER_APP_CLUSTER = 'eu';

  constructor() { }
  connect(): void {
    if (!this.pusher) {
      this.pusher = new Pusher(this.PUSHER_APP_KEY, {
        cluster: this.PUSHER_APP_CLUSTER,
      });

      // Puoi sottoscriverti a canali pubblici qui, ad esempio
      // const channel = this.pusher.subscribe('my-channel');
      // channel.bind('my-event', (data: any) => {
      //   this.messagesSubject.next(data);
      // });

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

    // Potresti voler bindare eventi specifici, ad esempio:
    // channel.bind('violation-recorded', (data: any) => {
    //   eventSubject.next({ eventName: 'violation-recorded', data });
    // });

    return eventSubject.asObservable();
  }

  unsubscribeFromChannel(channelName: string): void {
    if (this.pusher) {
      this.pusher.unsubscribe(channelName);
      console.log(`Unsubscribed from ${channelName}`);
    }
  }

  disconnect(): void {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
      console.log('Pusher client disconnected.');
    }
  }

  sendMessage(message: any): void {
    console.warn('sendMessage is not typically used with Pusher Channels for client-to-server communication.');
    // Potresti voler usare HttpClient per inviare dati al backend se necessario
  }

  getMessages(): Observable<any> {
    return this.messagesSubject.asObservable();
  }
}
