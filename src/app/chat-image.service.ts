import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ImageGenerationEvent {
  type: 'partial' | 'final' | 'error' | 'start';
  imageData?: string; // base64
  partialIndex?: number;
  isComplete?: boolean;
  error?: string;
}

export interface GenerationProgress {
  isGenerating: boolean;
  partialImages: string[];
  finalImage?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatImageService {
  private readonly apiKey = '';
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor() { }

  /**
   * Genera imágenes con streaming simulado de parciales
   * @param prompt - Descripción de la imagen a generar
   * @param partialImages - Número de imágenes parciales a simular (1-3)
   * @returns Observable con los eventos de generación
   */
  generateImageWithStreaming(prompt: string, partialImages: number = 3): Observable<ImageGenerationEvent> {
    const subject = new Subject<ImageGenerationEvent>();

    this.streamImageGenerationWithSimulation(prompt, partialImages, subject);

    return subject.asObservable();
  }

  private async streamImageGenerationWithSimulation(
    prompt: string, 
    partialImages: number, 
    subject: Subject<ImageGenerationEvent>
  ): Promise<void> {
    try {
      subject.next({ type: 'start' });

      const requestBody = {
        prompt: prompt,
        model: 'gpt-image-1',    
        stream: true,
        partial_images: partialImages,
        size: '1024x1024'        
      };

      console.log('🚀 Enviando solicitud a Images API:', requestBody);

      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error de Images API:', response.status, errorText);
        throw new Error(`Error HTTP: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No se pudo obtener el reader del stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let hasReceivedFinalImage = false;
      let finalImageData = '';

      while (true) {
        const { value, done } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') {
              // Si tenemos imagen final pero no simulamos parciales, las creamos ahora
              if (hasReceivedFinalImage && finalImageData && partialImages > 1) {
                await this.simulatePartialsFromFinal(finalImageData, partialImages, subject);
              }
              subject.next({ type: 'final', isComplete: true });
              subject.complete();
              return;
            }

            try {
              const event = JSON.parse(jsonStr);
              const result = await this.handleImageEventWithSimulation(event, subject, partialImages);
              if (result?.finalImage) {
                hasReceivedFinalImage = true;
                finalImageData = result.finalImage;
              }
            } catch (parseError) {
              console.warn('Error parsing JSON:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error en generación de imagen:', error);
      subject.next({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      });
      subject.error(error);
    }
  }

  private async handleImageEventWithSimulation(
    event: any, 
    subject: Subject<ImageGenerationEvent>,
    partialImages: number
  ): Promise<{finalImage?: string} | null> {
    console.log('🔥 Evento de Images API recibido:', event.type, event);
    
    // Si recibimos imagen parcial real, la enviamos directamente
    if (event.type === 'image_generation.partial_image') {
      console.log('📸 Imagen parcial real #', event.partial_image_index);
      subject.next({
        type: 'partial',
        imageData: `data:image/png;base64,${event.b64_json}`,
        partialIndex: event.partial_image_index,
        isComplete: false
      });
      return null;
    } 
    // Si recibimos imagen completa, simulamos las parciales primero
    else if (event.type === 'image_generation.completed' || event.type === 'image_generation.image') {
      console.log('✅ Imagen final recibida - simulando parciales...');
      const finalImageB64 = event.b64_json;
      
      if (partialImages > 1) {
        await this.simulatePartialsFromFinal(finalImageB64, partialImages, subject);
      }
      
      // Luego enviar la imagen final
      subject.next({
        type: 'final',
        imageData: `data:image/png;base64,${finalImageB64}`,
        isComplete: true
      });
      
      return { finalImage: finalImageB64 };
    }
    
    return null;
  }

  private async simulatePartialsFromFinal(
    finalImageB64: string, 
    partialCount: number, 
    subject: Subject<ImageGenerationEvent>
  ): Promise<void> {
    console.log(`🎭 Simulando ${partialCount} imágenes parciales...`);
    
    try {
      // Convertir base64 a canvas para manipular
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          resolve(void 0);
        };
        img.onerror = reject;
        img.src = `data:image/png;base64,${finalImageB64}`;
      });
      
      // Generar parciales con diferentes efectos
      for (let i = 0; i < partialCount; i++) {
        await this.delay(800); // Simular tiempo de generación
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Aplicar efectos progresivos para simular "parciales"
        if (i === 0) {
          // Primera parcial: más borrosa y con menor resolución
          ctx.filter = 'blur(3px) brightness(0.8)';
          ctx.drawImage(img, 0, 0);
        } else if (i === 1) {
          // Segunda parcial: menos borrosa
          ctx.filter = 'blur(1px) brightness(0.9)';
          ctx.drawImage(img, 0, 0);
        } else {
          // Tercera parcial: casi final
          ctx.filter = 'brightness(0.95)';
          ctx.drawImage(img, 0, 0);
        }
        
        // Convertir a base64 y enviar
        const partialB64 = canvas.toDataURL('image/png').split(',')[1];
        
        console.log(`📸 Enviando parcial #${i}`);
        subject.next({
          type: 'partial',
          imageData: `data:image/png;base64,${partialB64}`,
          partialIndex: i,
          isComplete: false
        });
      }
      
    } catch (error) {
      console.error('Error simulando parciales:', error);
      // Si falla la simulación, continuar sin parciales
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}