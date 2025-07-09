import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  async analyzeEnvironment(): Promise<any> {
    return {
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      cookiesEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
      batteryLevel: await this.getBatteryLevel(),
      networkInfo: await this.getNetworkInfo()
    };
  }

  private async getBatteryLevel(): Promise<number | null> {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return battery.level;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  private async getNetworkInfo(): Promise<any> {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt
      };
    }
    return null;
  }
}
