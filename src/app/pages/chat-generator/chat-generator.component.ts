import { Component, ElementRef, ViewChild, AfterViewChecked, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChatImageService, ImageGenerationEvent } from '../../chat-image.service';


interface ChatMessage {
  user: boolean;
  type: 'text' | 'image-generation';
  content: string;
  timestamp?: Date;
  generationState?: {
    isGenerating: boolean;
    partialImages: string[];
    finalImage?: string;
    error?: string;
    prompt?: string;
  };
}

@Component({
  selector: 'app-chat-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './chat-generator.component.html',
  styleUrls: ['./chat-generator.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ChatGeneratorComponent implements AfterViewChecked {
  @ViewChild('chatBox') private chatBox!: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  userInput: string = '';
  isGenerating: boolean = false;
  currentTime = '';

  constructor(private http: HttpClient, private imageService: ChatImageService) {
    this.updateTime();
    this.addWelcomeMessage();
    setInterval(() => this.updateTime(), 1000);
  }

  private updateTime(): void {
    const now = new Date();
    const date = now.toLocaleDateString('es-ES');
    const time = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    this.currentTime = `${date} ${time}`;
  }

  private addWelcomeMessage(): void {
    this.addMessage(false, 'text', '👋 **¡Bienvenido al Generador de Imágenes con IA!**\n\n📸 **¿Cómo funciona?**\n• Describe la imagen que quieres crear\n• La IA la generará paso a paso\n• Verás el progreso en tiempo real\n\n🚀 **¡Empecemos! Escribe tu prompt.**');
  }

  onEnterKey(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    if (!this.userInput.trim() || this.isGenerating) return;
    
    // Agregar mensaje del usuario
    this.addMessage(true, 'text', this.userInput);
    
    // Crear mensaje de generación
    const generationMsg: ChatMessage = {
      user: false,
      type: 'image-generation',
      content: '🎨 Generando tu imagen...',
      timestamp: new Date(),
      generationState: {
        isGenerating: true,
        partialImages: [],
        finalImage: undefined,
        error: undefined,
        prompt: this.userInput
      }
    };
    
    this.messages.push(generationMsg);
    this.isGenerating = true;
    
    // Conectar con servicio real de imágenes
    this.generateImageWithAPI(generationMsg);
    
    this.userInput = '';
    this.scrollToBottomManual();
  }

  sendQuickMessage(prompt: string): void {
    this.userInput = prompt;
    this.sendMessage();
  }

  private generateImageWithAPI(generationMsg: ChatMessage): void {
    if (!generationMsg.generationState?.prompt) return;

    // Inicializar array de parciales
    if (generationMsg.generationState) {
      generationMsg.generationState.partialImages = [];
    }

    // Usar el servicio real
    this.imageService.generateImageWithStreaming(generationMsg.generationState.prompt, 3)
      .subscribe({
        next: (event: ImageGenerationEvent) => {
          console.log('Evento recibido:', event);
          
          if (event.type === 'start') {
            console.log('🚀 Iniciando generación...');
            
          } else if (event.type === 'partial') {
            // Imagen parcial real del servicio
            if (generationMsg.generationState && event.imageData && event.partialIndex !== undefined) {
              if (!generationMsg.generationState.partialImages) {
                generationMsg.generationState.partialImages = [];
              }
              generationMsg.generationState.partialImages[event.partialIndex] = event.imageData;
              console.log(`📸 Parcial ${event.partialIndex} recibida`);
            }
            
          } else if (event.type === 'final') {
            // Imagen final del servicio
            if (generationMsg.generationState && event.imageData) {
              // Si no hay parciales reales, simular con la imagen final
              if (!generationMsg.generationState.partialImages?.length) {
                this.simulatePartialsFromFinalImage(event.imageData, generationMsg);
              }
              
              generationMsg.generationState.finalImage = event.imageData;
              generationMsg.generationState.isGenerating = false;
              this.isGenerating = false;
              console.log('✅ Imagen final recibida');
            }
            
          } else if (event.type === 'error') {
            if (generationMsg.generationState) {
              generationMsg.generationState.error = event.error || 'Error desconocido';
              generationMsg.generationState.isGenerating = false;
              this.isGenerating = false;
              console.error('❌ Error:', event.error);
            }
          }
        },
        error: (error) => {
          console.error('❌ Error del servicio:', error);
          if (generationMsg.generationState) {
            generationMsg.generationState.error = 'Error generando imagen: ' + error.message;
            generationMsg.generationState.isGenerating = false;
            this.isGenerating = false;
          }
        }
      });
  }

  private simulatePartialsFromFinalImage(finalImageData: string, generationMsg: ChatMessage): void {
    console.log('🎭 Simulando parciales desde imagen final...');
    
    if (!generationMsg.generationState) return;
    
    // Crear 3 versiones simuladas de la imagen final
    const delays = [0, 800, 1600]; // Tiempos escalonados
    
    delays.forEach((delay, index) => {
      setTimeout(() => {
        if (generationMsg.generationState) {
          const simulatedPartial = this.createSimulatedPartial(finalImageData, index);
          
          if (!generationMsg.generationState.partialImages) {
            generationMsg.generationState.partialImages = [];
          }
          
          generationMsg.generationState.partialImages[index] = simulatedPartial;
          console.log(`🎨 Parcial simulada ${index + 1} creada`);
        }
      }, delay);
    });
  }

  private createSimulatedPartial(originalImage: string, step: number): string {
    // Por ahora retornar la imagen original
    // En el CSS se aplicarán los filtros según la clase
    return originalImage;
  }

  hasPartialImages(msg: ChatMessage): boolean {
    return !!(msg.generationState?.partialImages && 
             msg.generationState.partialImages.length > 0 &&
             msg.generationState.partialImages.some(img => img));
  }

  hasFinalImage(msg: ChatMessage): boolean {
    return !!(msg.generationState?.finalImage && 
             msg.generationState.finalImage.length > 0);
  }

  private addMessage(user: boolean, type: 'text' | 'image-generation', content: string): void {
    this.messages.push({
      user,
      type,
      content,
      timestamp: new Date()
    });
  }

  formatMessage(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  getMessageTime(message: ChatMessage): string {
    if (!message.timestamp) return '';
    const date = message.timestamp.toLocaleDateString('es-ES');
    const time = message.timestamp.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${date} ${time}`;
  }

  getCurrentTime(): string {
    const now = new Date();
    const date = now.toLocaleDateString('es-ES');
    const time = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${date} ${time}`;
  }

  ngAfterViewChecked(): void {
    // Sin scroll automático
  }

  private scrollToBottomManual(): void {
    // Solo cuando el usuario envía un mensaje
    try {
      if (this.chatBox?.nativeElement) {
        const element = this.chatBox.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (error) {
      // Silenciar errores
    }
  }

  clearChat(): void {
    this.messages = [];
    this.isGenerating = false;
    this.addWelcomeMessage();
  }
}