import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../enviroments/environment';

@Injectable({
  providedIn: 'root'
})
export class OpenAIService {
  private baseUrl = 'https://api.openai.com/v1';
  private apiKey = environment.apiKey;
  private assistantId = 'asst_zYwhn4A5fR3bdzbNtoMRiayn';
  private threadId: string | null = null;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    });
  }

  private getFormHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.apiKey}`
    });
  }

  private createThread(): Observable<any> {
    return this.http.post(`${this.baseUrl}/threads`, {}, { headers: this.getHeaders() });
  }

  private addMessage(threadId: string, content: any): Observable<any> {
    const body = {
      role: 'user',
      content: content
    };
    return this.http.post(`${this.baseUrl}/threads/${threadId}/messages`, body, { headers: this.getHeaders() });
  }

  private runAssistant(threadId: string): Observable<any> {
    const body = {
      assistant_id: this.assistantId
    };
    return this.http.post(`${this.baseUrl}/threads/${threadId}/runs`, body, { headers: this.getHeaders() });
  }

  private getRun(threadId: string, runId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/threads/${threadId}/runs/${runId}`, { headers: this.getHeaders() });
  }

  private getMessages(threadId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/threads/${threadId}/messages`, { headers: this.getHeaders() });
  }

  async sendMessage(message: string): Promise<Observable<string>> {
    try {
      if (!this.threadId) {
        const threadResponse = await firstValueFrom(this.createThread());
        this.threadId = threadResponse.id;
      }

      if (!this.threadId) {
        throw new Error('No se pudo crear el thread');
      }

      const currentThreadId = this.threadId;

      await firstValueFrom(this.addMessage(currentThreadId, message));

      const runResponse = await firstValueFrom(this.runAssistant(currentThreadId));
      const runId = runResponse.id;

      return new Observable<string>(observer => {
        let attempts = 0;
        const maxAttempts = 200;

        const checkStatus = async () => {
          try {
            attempts++;
            const run = await firstValueFrom(this.getRun(currentThreadId, runId));

            if (run.status === 'completed') {
              const messages = await firstValueFrom(this.getMessages(currentThreadId));
              const lastMessage = messages.data[0];

              if (lastMessage && lastMessage.content && lastMessage.content[0]) {
                const response = lastMessage.content[0].text.value;
                observer.next(response);
                observer.complete();
              } else {
                observer.error(new Error('No se pudo obtener la respuesta'));
              }
            } else if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
              observer.error(new Error(`Error en el asistente: ${run.status}`));
            } else if (run.status === 'requires_action') {
              observer.error(new Error('El asistente requiere una acción adicional'));
            } else if (attempts >= maxAttempts) {
              observer.error(new Error('El asistente tardó demasiado en responder'));
            } else {
              setTimeout(checkStatus, 200);
            }
          } catch (error) {
            observer.error(error);
          }
        };

        checkStatus();
      });

    } catch (error) {
      throw error;
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData();

      let fileName = 'audio.webm';
      if (audioBlob.type.includes('mp3')) fileName = 'audio.mp3';
      else if (audioBlob.type.includes('wav')) fileName = 'audio.wav';
      else if (audioBlob.type.includes('m4a')) fileName = 'audio.m4a';

      formData.append('file', audioBlob, fileName);
      formData.append('model', 'whisper-1');
      formData.append('language', 'es');

      const response = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}/audio/transcriptions`, formData, {
          headers: this.getFormHeaders()
        })
      );

      const transcription = response.text || '';

      if (!transcription.trim()) {
        throw new Error('Transcripción vacía');
      }

      return transcription;

    } catch (error) {
      throw new Error('Error al transcribir el audio');
    }
  }

  async generateSpeech(text: string): Promise<Blob> {
    try {
      const body = {
        model: 'tts-1',
        input: text,
        voice: 'nova',
        response_format: 'mp3'
      };

      const response = await firstValueFrom(
        this.http.post(`${this.baseUrl}/audio/speech`, body, {
          headers: this.getHeaders(),
          responseType: 'blob'
        })
      );

      return response;
    } catch (error) {
      throw new Error('No se pudo generar el audio');
    }
  }
}
