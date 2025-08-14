import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OpenAIService {
  private baseUrl = 'https://api.openai.com/v1';
  private apiKey = 'process.env.OPENAI_API_KEY;';

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

  private createThread(): Observable<any> {
    return this.http.post(`${this.baseUrl}/threads`, {}, { headers: this.getHeaders() });
  }

  private addMessage(threadId: string, content: string): Observable<any> {
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
      // Si no hay thread, crear uno nuevo
      if (!this.threadId) {
        const threadResponse = await firstValueFrom(this.createThread());
        this.threadId = threadResponse.id;
        console.log('Thread creado:', this.threadId);
      }

      if (!this.threadId) {
        throw new Error('No se pudo crear el thread');
      }

      const currentThreadId = this.threadId;

      // Añadir mensaje al thread
      await firstValueFrom(this.addMessage(currentThreadId, message));
      console.log('Mensaje añadido al thread');

      // Ejecutar el asistente (sin streaming por ahora, pero más rápido)
      const runResponse = await firstValueFrom(this.runAssistant(currentThreadId));
      const runId = runResponse.id;
      console.log('Asistente ejecutándose:', runId);

      // Polling súper agresivo y optimizado
      return new Observable<string>(observer => {
        let attempts = 0;
        const maxAttempts = 300; // 1 minuto máximo (300 * 200ms)

        const checkStatus = async () => {
          try {
            attempts++;
            const run = await firstValueFrom(this.getRun(currentThreadId, runId));
            console.log(`[${attempts}] Estado del run:`, run.status);

            if (run.status === 'completed') {
              // Obtener la respuesta inmediatamente
              const messages = await firstValueFrom(this.getMessages(currentThreadId));
              const lastMessage = messages.data[0];

              if (lastMessage && lastMessage.content && lastMessage.content[0]) {
                const response = lastMessage.content[0].text.value;
                console.log('✅ Respuesta obtenida:', response);
                observer.next(response);
                observer.complete();
              } else {
                observer.error(new Error('No se pudo obtener la respuesta'));
              }
            } else if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
              observer.error(new Error(`Run falló con estado: ${run.status}`));
            } else if (run.status === 'requires_action') {
              console.log('⚠️ El run requiere acción:', run.required_action);
              observer.error(new Error('El asistente requiere una acción adicional'));
            } else if (attempts >= maxAttempts) {
              observer.error(new Error('Timeout: El asistente tardó demasiado en responder'));
            } else {
              // Polling ultra rápido: cada 100ms para obtener respuesta instantánea
              setTimeout(checkStatus, 100);
            }
          } catch (error) {
            console.error('❌ Error en checkStatus:', error);
            observer.error(error);
          }
        };

        // Empezar inmediatamente
        checkStatus();
      });

    } catch (error) {
      console.error('Error en sendMessage:', error);
      throw error;
    }
  }
}
